// Runtime regression is isolated; TypeScript and the Next production build are separate release gates.
module.exports = { rootDir: __dirname, ...{
  "testEnvironment": "jest-environment-jsdom",
  "setupFilesAfterEnv": [
    "<rootDir>/jest.setup.ts"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        "isolatedModules": true,
        "tsconfig": {
          "jsx": "react-jsx",
          "moduleResolution": "node",
          "module": "commonjs",
          "strict": true,
          "esModuleInterop": true
        },
        "diagnostics": true
      }
    ]
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|svg|webp)$": "<rootDir>/__mocks__/fileMock.js"
  },
  "testMatch": [
    "<rootDir>/src/utils/__tests__/commercialOrders.test.ts",
    "<rootDir>/src/utils/__tests__/commercialOrderReporting.test.ts",
    "<rootDir>/src/utils/__tests__/clientPurchaseAmounts.test.ts",
    "<rootDir>/src/utils/__tests__/salesMoney.test.ts",
    "<rootDir>/src/utils/__tests__/orderCollectionAmount.test.ts",
    "<rootDir>/src/services/__tests__/commercialLeadsService.test.ts",
    "<rootDir>/src/services/__tests__/commercialOrderPreparationService.test.ts",
    "<rootDir>/src/services/__tests__/leadPaymentsService.test.ts",
    "<rootDir>/src/services/__tests__/commercialLeadReportsService.test.ts",
    "<rootDir>/src/services/__tests__/quotationService.test.ts",
    "<rootDir>/src/services/__tests__/cierreDiaCommercialReporting.test.ts",
    "<rootDir>/src/components/commercial-leads/__tests__/commercial-leads.test.tsx",
    "<rootDir>/src/components/commercial-leads/__tests__/payment-workflows.test.tsx",
    "<rootDir>/src/components/commercial-leads/__tests__/paymentPresentation.test.ts",
    "<rootDir>/src/components/dashboard/__tests__/CommercialCashSummary.test.tsx",
    "<rootDir>/src/app/metricas/leads/__tests__/page.test.tsx",
    "<rootDir>/src/components/modals/__tests__/PaymentVerificationModal.test.tsx",
    "<rootDir>/src/utils/__tests__/customerServiceOrderAccess.test.ts",
    "<rootDir>/src/components/modals/__tests__/CustomerServiceModal.cc-access.integration.test.tsx",
    "<rootDir>/src/components/modals/__tests__/CustomerServiceModal.cc-confirmation.test.tsx",
    "<rootDir>/src/components/atencion-cliente/cc-v2/__tests__/CcGestionPanel.test.tsx",
    "<rootDir>/src/components/atencion-cliente/cc-v2/__tests__/CcSaleConfirmationPanel.test.tsx",
    "<rootDir>/src/app/registrar-venta/__tests__/page.test.tsx",
    "<rootDir>/src/app/registrar-venta/__tests__/page.sale-origin.test.tsx",
    "<rootDir>/src/app/registrar-venta/__tests__/sessionRecovery.integration.test.tsx",
    "<rootDir>/src/app/registrar-venta/__tests__/page.editDeliveryType.test.tsx",
    "<rootDir>/src/services/__tests__/saleTrackingService.test.ts",
    "<rootDir>/src/services/__tests__/inventoryTrackingService.test.ts",
    "<rootDir>/src/components/registrar-venta/__tests__/useSaleOrigin.test.tsx",
    "<rootDir>/src/components/registrar-venta/__tests__/SaleUnitSelection.test.tsx",
    "<rootDir>/src/components/registrar-venta/__tests__/SaleChannelField.test.tsx"
  ],
  "testPathIgnorePatterns": [
    "/node_modules/",
    "/.next/"
  ],
  "modulePathIgnorePatterns": [
    "<rootDir>/.next/"
  ],
  "maxWorkers": 1
} };
