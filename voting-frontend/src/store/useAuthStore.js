import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import CryptoJS from 'crypto-js'; // Import CryptoJS

import { createJSONStorage } from 'zustand/middleware';

import axios from 'axios';
const API_URL = '/api/auth';

// Enable cookies for all requests
axios.defaults.withCredentials = true;

const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null, // Stores full user object { id, username, name }
            username: null, // Short access
            role: null, // 'admin', 'voter'
            electionId: null,
            merkleRoot: null,
            commitment: null,
            token: null, // JWT Token for session storage
            isLoading: false,
            error: null,

            // Actions
            login: async (username, password) => {
                set({ isLoading: true, error: null });
                try {
                    // Hash password to match registration logic
                    const hashedPassword = CryptoJS.SHA256(password).toString();
                    const response = await axios.post(`${API_URL}/login`, { username, password: hashedPassword });
                    const userData = response.data;

                    // Set access token for this session
                    if (userData.accessToken) {
                        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.accessToken}`;
                    }

                    set({
                        user: userData,
                        username: userData.username,
                        token: userData.accessToken,
                        isLoading: false,
                        error: null
                    });

                    return userData;
                } catch (error) {
                    set({
                        isLoading: false,
                        error: error.response?.data?.message || 'Login failed'
                    });
                    throw error;
                }
            },

            register: async (userData) => {
                set({ isLoading: true, error: null });
                try {
                    await axios.post(`${API_URL}/register`, userData);
                    set({ isLoading: false, error: null });
                } catch (error) {
                    set({
                        isLoading: false,
                        error: error.response?.data?.message || 'Registration failed'
                    });
                    throw error;
                }
            },

            logout: async () => {
                try {
                    await axios.post(`${API_URL}/logout`); // Call backend to clear cookie
                } catch (err) {
                    console.error("Logout failed", err);
                }
                set({ user: null, username: null, role: null, electionId: null, merkleRoot: null, commitment: null, token: null });
                delete axios.defaults.headers.common['Authorization'];
                sessionStorage.clear();
            },

            setRole: (role) => set({ role }),
            setElectionId: (id) => set({ electionId: id }),
            setMerkleRoot: (root) => set({ merkleRoot: root }),
            setCommitment: (c) => set({ commitment: c }),
            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => sessionStorage),
            onRehydrateStorage: () => (state) => {
                if (state && state.token) {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
                }
            }
        }
    )
);

export default useAuthStore;
