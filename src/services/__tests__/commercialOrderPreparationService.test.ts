import axiosAuth from "@/lib/axiosAuth";
import {GATEWAY} from "@/lib/gateway";
import {prepareCommercialOrder} from "../commercialOrderPreparationService";
jest.mock("@/lib/axiosAuth",()=>({__esModule:true,default:{post:jest.fn(),patch:jest.fn()}}));
beforeEach(()=>jest.clearAllMocks());
it("prepares the same reviewed order through the authenticated production stock engine",async()=>{
 const order={id:"order/a",commercialStage:"SALE",commercialStockState:"NOT_REQUIRED"};
 jest.mocked(axiosAuth.post).mockResolvedValue({data:order});
 await expect(prepareCommercialOrder("order/a","2026-10-21T01:00:00.000Z")).resolves.toBe(order);
 expect(axiosAuth.post).toHaveBeenCalledTimes(1);
 expect(axiosAuth.post).toHaveBeenCalledWith(`${GATEWAY.ventas}/order-header/manual/order%2Fa/commercial-preparation`,{expectedOrderUpdatedAt:"2026-10-21T01:00:00.000Z"});
 expect(axiosAuth.patch).not.toHaveBeenCalled();
});
it("preserves a stale-version rejection without legacy status or stock fallback",async()=>{
 const conflict={response:{status:409}};jest.mocked(axiosAuth.post).mockRejectedValue(conflict);
 await expect(prepareCommercialOrder("order/a","2026-10-21T01:00:00.000Z")).rejects.toBe(conflict);
 expect(axiosAuth.post).toHaveBeenCalledTimes(1);expect(axiosAuth.patch).not.toHaveBeenCalled();
});
