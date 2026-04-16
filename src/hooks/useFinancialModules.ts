import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/utils/format";
import { Database } from "@/integrations/supabase/types";

type BankAccount = Database["public"]["Tables"]["financial_bank_accounts"]["Row"];
type Receivable = Database["public"]["Tables"]["financial_receivables"]["Row"];
type Payable = Database["public"]["Tables"]["financial_payables"]["Row"];
type BankTransaction = Database["public"]["Tables"]["financial_bank_transactions"]["Row"];

export function useBankAccounts(workspaceId?: string) {
    const queryClient = useQueryClient();

    const { data: accounts, isLoading } = useQuery({
        queryKey: ["financial_bank_accounts", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financial_bank_accounts")
                .select("*")
                .eq("workspace_id", workspaceId!)
                .order("name");
            if (error) throw error;
            return data;
        },
    });

    const createAccount = useMutation({
        mutationFn: async (newAccount: Database["public"]["Tables"]["financial_bank_accounts"]["Insert"]) => {
            const { data, error } = await supabase.from("financial_bank_accounts").insert(newAccount).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts", variables.workspace_id] });
        },
    });

    const updateAccount = useMutation({
        mutationFn: async (account: Database["public"]["Tables"]["financial_bank_accounts"]["Update"] & { id: string; workspace_id: string }) => {
            const { data, error } = await supabase
                .from("financial_bank_accounts")
                .update(account)
                .eq("id", account.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts", variables.workspace_id] });
        },
    });

    const deleteAccount = useMutation({
        mutationFn: async ({ accountId, workspaceId }: { accountId: string; workspaceId: string }) => {
            const { error } = await supabase
                .from("financial_bank_accounts")
                .delete()
                .eq("id", accountId);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts", variables.workspaceId] });
        }
    });

    return { accounts, isLoading, createAccount, updateAccount, deleteAccount };
}

export function useReceivables(workspaceId?: string) {
    const queryClient = useQueryClient();

    const { data: receivables, isLoading } = useQuery({
        queryKey: ["financial_receivables", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await (supabase as any)
                    .from("financial_receivables")
                    .select(`
                        *,
                        financial_categories (name),
                        clients (name),
                        financial_cost_centers (name),
                        financial_bank_transactions (id),
                        financial_bank_accounts (name),
                        financial_attachments (id),
                        financial_allocations (*, financial_categories(name), financial_cost_centers(name))
                    `)
                    .eq("workspace_id", workspaceId!)
                    .order("due_date")
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    hasMore = data.length === pageSize;
                    page++;
                } else {
                    hasMore = false;
                }
            }
            return allData;
        },
    });

    const createReceivable = useMutation({
        mutationFn: async ({ item, allocations }: { item: Database["public"]["Tables"]["financial_receivables"]["Insert"], allocations?: any[] }) => {
            const { data, error } = await supabase.from("financial_receivables").insert(item).select().single();
            if (error) throw error;

            if (allocations && allocations.length > 0) {
                const allocationsToInsert = allocations.map(a => ({
                    receivable_id: data.id,
                    workspace_id: item.workspace_id,
                    category_id: a.category_id,
                    cost_center_id: a.cost_center_id || null,
                    amount: a.amount,
                    percentage: a.percentage
                }));
                const { error: allocError } = await supabase.from("financial_allocations").insert(allocationsToInsert);
                if (allocError) throw allocError;
            }

            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_receivables", variables.item.workspace_id] });
        },
    });

    const updateReceivable = useMutation({
        mutationFn: async ({ item, allocations }: { item: Database["public"]["Tables"]["financial_receivables"]["Update"] & { id: string, workspace_id: string }, allocations?: any[] }) => {
            const { data, error } = await supabase
                .from("financial_receivables")
                .update(item)
                .eq("id", item.id)
                .select()
                .single();
            if (error) throw error;

            if (allocations) {
                // Delete existing
                await supabase.from("financial_allocations").delete().eq("receivable_id", item.id);

                if (allocations.length > 0) {
                    const allocationsToInsert = allocations.map(a => ({
                        receivable_id: item.id,
                        workspace_id: item.workspace_id,
                        category_id: a.category_id,
                        cost_center_id: a.cost_center_id || null,
                        amount: a.amount,
                        percentage: a.percentage
                    }));
                    const { error: allocError } = await supabase.from("financial_allocations").insert(allocationsToInsert);
                    if (allocError) throw allocError;
                }
            }

            // Sync with Contracts
            if (data?.contract_billing_id && item.status) {
                // Se o status mudou, atualiza a cobrança de contrato
                const status = item.status as string;
                if (status === 'paid' || status === 'pending') {
                    const { error: syncError } = await supabase
                        .from("contract_billings")
                        .update({
                            status: status === 'paid' ? 'paid' : 'pending',
                            payment_date: status === 'paid' ? (item.payment_date || getLocalDateString()) : null,
                        })
                        .eq('id', data.contract_billing_id);

                    if (syncError) console.error("Error syncing status to contract billing:", syncError);
                }
            }

            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_receivables", variables.item.workspace_id] });
        },
    });


    const deleteReceivable = useMutation({
        mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
            // First get the item to check for linked billing
            const { data: item } = await supabase
                .from("financial_receivables")
                .select("contract_billing_id")
                .eq("id", id)
                .maybeSingle();

            // Delete the receivable
            const { error } = await supabase
                .from("financial_receivables")
                .delete()
                .eq("id", id);

            if (error) throw error;

            // If it was linked to a contract billing, only unlink (set to pending) — do NOT delete the billing
            if (item?.contract_billing_id) {
                await supabase
                    .from("contract_billings")
                    .update({ status: "pending", payment_date: null })
                    .eq("id", item.contract_billing_id);
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_receivables", variables.workspaceId] });
        },
    });

    return { receivables, isLoading, createReceivable, updateReceivable, deleteReceivable };
}

export function usePayables(workspaceId?: string) {
    const queryClient = useQueryClient();

    const { data: payables, isLoading } = useQuery({
        queryKey: ["financial_payables", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await (supabase as any)
                    .from("financial_payables")
                    .select(`
                        *,
                        financial_categories (name),
                        financial_cost_centers (name),
                        financial_bank_transactions (id),
                        financial_bank_accounts (name),
                        financial_attachments (id),
                        financial_allocations (*, financial_categories(name), financial_cost_centers(name))
                    `)
                    .eq("workspace_id", workspaceId!)
                    .order("due_date")
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    hasMore = data.length === pageSize;
                    page++;
                } else {
                    hasMore = false;
                }
            }
            return allData;
        },
    });

    const createPayable = useMutation({
        mutationFn: async ({ item, allocations }: { item: Database["public"]["Tables"]["financial_payables"]["Insert"], allocations?: any[] }) => {
            const { data, error } = await supabase.from("financial_payables").insert(item).select().single();
            if (error) throw error;

            if (allocations && allocations.length > 0) {
                const allocationsToInsert = allocations.map(a => ({
                    payable_id: data.id,
                    workspace_id: item.workspace_id,
                    category_id: a.category_id,
                    cost_center_id: a.cost_center_id || null,
                    amount: a.amount,
                    percentage: a.percentage
                }));
                const { error: allocError } = await supabase.from("financial_allocations").insert(allocationsToInsert);
                if (allocError) throw allocError;
            }

            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_payables", variables.item.workspace_id] });
        },
    });

    const updatePayable = useMutation({
        mutationFn: async ({ item, allocations }: { item: Database["public"]["Tables"]["financial_payables"]["Update"] & { id: string, workspace_id: string }, allocations?: any[] }) => {
            const { data, error } = await supabase
                .from("financial_payables")
                .update(item)
                .eq("id", item.id)
                .select()
                .single();
            if (error) throw error;

            if (allocations) {
                await supabase.from("financial_allocations").delete().eq("payable_id", item.id);

                if (allocations.length > 0) {
                    const allocationsToInsert = allocations.map(a => ({
                        payable_id: item.id,
                        workspace_id: item.workspace_id,
                        category_id: a.category_id,
                        cost_center_id: a.cost_center_id || null,
                        amount: a.amount,
                        percentage: a.percentage
                    }));
                    const { error: allocError } = await supabase.from("financial_allocations").insert(allocationsToInsert);
                    if (allocError) throw allocError;
                }
            }

            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_payables", variables.item.workspace_id] });
        },
    });

    const deletePayable = useMutation({
        mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
            const { error } = await supabase
                .from("financial_payables")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_payables", variables.workspaceId] });
        },
    });

    return { payables, isLoading, createPayable, updatePayable, deletePayable };
}

export function useBankTransactions(workspaceId?: string, bankAccountId?: string) {
    const queryClient = useQueryClient();

    const { data: transactions, isLoading } = useQuery({
        queryKey: ["financial_bank_transactions", workspaceId, bankAccountId],
        enabled: !!workspaceId && !!bankAccountId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financial_bank_transactions")
                .select("*")
                .eq("workspace_id", workspaceId!)
                .eq("bank_account_id", bankAccountId!)
                .order("transaction_date", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const importTransactions = useMutation({
        mutationFn: async (transactions: Database["public"]["Tables"]["financial_bank_transactions"]["Insert"][]) => {
            const { data, error } = await supabase
                .from("financial_bank_transactions")
                .upsert(transactions, { onConflict: 'bank_account_id, fitid', ignoreDuplicates: true })
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            if (variables.length > 0) {
                queryClient.invalidateQueries({ queryKey: ["financial_bank_transactions", variables[0].workspace_id] });
            }
        },
    });

    return { transactions, isLoading, importTransactions };
}


export function useFinancialCategories(workspaceId?: string) {
    const queryClient = useQueryClient();

    const { data: categories, isLoading } = useQuery({
        queryKey: ["financial_categories", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financial_categories")
                .select("*")
                .eq("workspace_id", workspaceId!)
                .order("name");
            if (error) throw error;
            return data;
        },
    });

    const createCategory = useMutation({
        mutationFn: async (category: Database["public"]["Tables"]["financial_categories"]["Insert"]) => {
            const { data, error } = await supabase.from("financial_categories").insert(category).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_categories", variables.workspace_id] });
        },
    });

    const updateCategory = useMutation({
        mutationFn: async (category: Database["public"]["Tables"]["financial_categories"]["Update"] & { id: string; workspace_id: string }) => {
            const { data, error } = await supabase
                .from("financial_categories")
                .update(category)
                .eq("id", category.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_categories", variables.workspace_id] });
        },
    });

    const deleteCategory = useMutation({
        mutationFn: async ({ categoryId, workspaceId }: { categoryId: string; workspaceId: string }) => {
            const { error } = await supabase
                .from("financial_categories")
                .delete()
                .eq("id", categoryId);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_categories", variables.workspaceId] });
        },
    });

    return { categories, isLoading, createCategory, updateCategory, deleteCategory };
}

export function useCostCenters(workspaceId?: string) {
    const queryClient = useQueryClient();

    const { data: costCenters, isLoading } = useQuery({
        queryKey: ["financial_cost_centers", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financial_cost_centers")
                .select("*")
                .eq("workspace_id", workspaceId!)
                .order("name");
            if (error) throw error;
            return data;
        },
    });

    const createCostCenter = useMutation({
        mutationFn: async (item: any) => {
            const { data, error } = await supabase.from("financial_cost_centers").insert(item).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_cost_centers", variables.workspace_id] });
        },
    });

    const updateCostCenter = useMutation({
        mutationFn: async (item: any) => {
            const { data, error } = await supabase
                .from("financial_cost_centers")
                .update(item)
                .eq("id", item.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_cost_centers", variables.workspace_id] });
        },
    });

    const deleteCostCenter = useMutation({
        mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
            const { error } = await supabase
                .from("financial_cost_centers")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_cost_centers", variables.workspaceId] });
        },
    });

    return { costCenters, isLoading, createCostCenter, updateCostCenter, deleteCostCenter };
}

export function useClients(workspaceId?: string) {
    const { data: clients, isLoading } = useQuery({
        queryKey: ["clients", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("clients")
                .select("*")
                .eq("workspace_id", workspaceId!)
                .order("name");
            if (error) throw error;
            return data;
        },
    });
    return { clients, isLoading };
}

export function useSuppliers(workspaceId?: string) {
    const queryClient = useQueryClient();

    const { data: suppliers, isLoading } = useQuery({
        queryKey: ["financial_suppliers", workspaceId],
        enabled: !!workspaceId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financial_suppliers")
                .select("*")
                .eq("workspace_id", workspaceId!)
                .order("name");
            if (error) throw error;
            return data;
        },
    });

    const createSupplier = useMutation({
        mutationFn: async (supplier: any) => {
            const { data, error } = await supabase
                .from("financial_suppliers")
                .insert(supplier)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_suppliers", variables.workspace_id] });
        },
    });

    const updateSupplier = useMutation({
        mutationFn: async (supplier: any) => {
            const { data, error } = await supabase
                .from("financial_suppliers")
                .update(supplier)
                .eq("id", supplier.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_suppliers", variables.workspace_id] });
        },
    });

    const deleteSupplier = useMutation({
        mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
            const { error } = await supabase
                .from("financial_suppliers")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["financial_suppliers", variables.workspaceId] });
        },
    });

    return { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier };
}
