import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

const ProtectedRoute = ({ redirectPath = '/login' }) => {
    const { username, token } = useAuthStore();

    // Check for authentication (basic check: username/token existence)
    // You might want to enhance this with token expiration checks if needed
    if (!username && !token) {
        return <Navigate to={redirectPath} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
