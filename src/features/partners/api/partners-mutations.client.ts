import axios from "axios";

// Protected mutations receive their initiating session's bearer explicitly.
// Keep them off the shared interceptor that reads the mutable token store.
const partnersMutationsClient = axios.create();

export default partnersMutationsClient;
