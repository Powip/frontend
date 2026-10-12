import axios from "axios";
import { tokenStore } from "./tokenStore";

const axiosAuth = axios.create();

axiosAuth.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

export default axiosAuth;
