import axios from "axios";
import { tokenStore } from "./tokenStore";

const axiosAuth = axios.create();

axiosAuth.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosAuth;
