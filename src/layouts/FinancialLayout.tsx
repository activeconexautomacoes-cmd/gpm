import { Outlet } from "react-router-dom";

export default function FinancialLayout() {
    return (
        <div className="p-4 md:p-6">
            <Outlet />
        </div>
    );
}
