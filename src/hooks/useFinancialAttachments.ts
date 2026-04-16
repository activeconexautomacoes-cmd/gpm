import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Attachment = Database["public"]["Tables"]["financial_attachments"]["Row"];

export function useFinancialAttachments(receivableId?: string, payableId?: string) {
    const queryClient = useQueryClient();

    const { data: attachments, isLoading } = useQuery({
        queryKey: ["financial_attachments", receivableId, payableId],
        queryFn: async () => {
            if (!receivableId && !payableId) return [];

            let query = supabase
                .from("financial_attachments")
                .select("*")
                .order("created_at", { ascending: false });

            if (receivableId) {
                query = query.eq("receivable_id", receivableId);
            }
            if (payableId) {
                query = query.eq("payable_id", payableId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!receivableId || !!payableId
    });

    const uploadAttachment = useMutation({
        mutationFn: async ({ file, workspaceId, receivableId: overrideReceivableId, payableId: overridePayableId }: { file: File, workspaceId: string, receivableId?: string, payableId?: string }) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${workspaceId}/${crypto.randomUUID()}.${fileExt}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('financial-attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('financial-attachments')
                .getPublicUrl(fileName);

            // Use override IDs if provided, otherwise fallback to hook args
            const finalReceivableId = overrideReceivableId || receivableId || null;
            const finalPayableId = overridePayableId || payableId || null;

            // Save to database
            const { data, error: dbError } = await supabase
                .from("financial_attachments")
                .insert({
                    workspace_id: workspaceId,
                    receivable_id: finalReceivableId,
                    payable_id: finalPayableId,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type,
                    file_url: publicUrl,
                    uploaded_by: (await supabase.auth.getUser()).data.user?.id
                })
                .select()
                .single();

            if (dbError) throw dbError;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["financial_attachments", receivableId, payableId] });
        }
    });

    const deleteAttachment = useMutation({
        mutationFn: async (attachment: Attachment) => {
            // Delete from storage (need to extract path from URL or store path)
            // Assuming file_url structure: .../financial-attachments/workspace_id/filename
            // Or easier, just delete the record and let a distinct cleanup process handle storage, OR parse the path.
            // Since we stored publicUrl, let's extract the path.
            // URL format: https://.../storage/v1/object/public/financial-attachments/workspace_id/filename
            // We need: workspace_id/filename

            const urlParts = attachment.file_url.split('/financial-attachments/');
            if (urlParts.length === 2) {
                const storagePath = urlParts[1];
                const { error: storageError } = await supabase.storage
                    .from('financial-attachments')
                    .remove([storagePath]);

                if (storageError) console.error("Error deleting file from storage:", storageError);
            }

            const { error } = await supabase
                .from("financial_attachments")
                .delete()
                .eq("id", attachment.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["financial_attachments", receivableId, payableId] });
        }
    });

    return {
        attachments,
        isLoading,
        uploadAttachment,
        deleteAttachment
    };
}
