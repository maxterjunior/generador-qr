import { useState } from "preact/compat";

export type AlertFloatType = {
    message: string;
    type: 'success' | 'error';
}
export const useAlertFloat = () => {
    const [alert, setAlert] = useState<AlertFloatType | null>(null);

    const showAlert = (alert: AlertFloatType) => {
        setAlert(alert);
    }

    const hideAlert = () => {
        setAlert(null);
    }

    const containerStyle = {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999
    }

    const alertComponent = alert ? (
        <div className={`alert alert-${alert.type}`} role="alert">
            {alert.message}
        </div>
    ) : null;

    return {
        alert,
        showAlert,
        hideAlert,
        alertComponent,
    }
}