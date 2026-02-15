// src/types/binance-connector.d.ts
declare module '@binance/connector' {
  // Aquí declares lo que la librería exporta.
  // Por ahora, con 'any' es suficiente para quitar el error.
  export const spot: any;
  // Puedes ser más específico si quieres en el futuro, por ejemplo:
  // export class Spot {
  //   constructor(apiKey?: string, apiSecret?: string, options?: any);
  //   exchangeInfo(): Promise<any>;
  //   // ... otras funciones que uses de la librería
  // }
}