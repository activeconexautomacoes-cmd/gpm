export interface SaleProduct {
    name: string;
    value: number;
    impl_fee: number;
    recurrence: string;
}

export type SaleType = 'Recorrente' | 'Avulso' | 'Misto';
export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'canceled';

export interface Sale {
    opportunity_id: string;
    workspace_id: string;
    won_at: string;
    client_name: string;
    company_name: string;
    client_id: string;
    total_value: number;
    payment_method: string | null;
    payment_status: PaymentStatus;
    sdr_name: string | null;
    closer_name: string | null;
    is_signed: boolean;
    contract_signature_status: string | null;
    contract_duration: string | null;
    products: SaleProduct[];
    sale_type: SaleType;
}

export interface SalesTableProps {
    sales: Sale[];
    isLoading: boolean;
    onSaleClick: (sale: Sale) => void;
}
