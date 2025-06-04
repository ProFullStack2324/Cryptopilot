// src/app/api/binance/trade/buy/route.ts
// IMPORTANTE: NO USAR ESTO EN PRODUCCIÓN. SOLO PARA PRUEBAS Y DEMOSTRACIÓN.
// Realizar operaciones de trading con GET es un riesgo de seguridad MUY GRANDE.

import { NextResponse } from 'next/server';
import Binance from 'node-binance-api';

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
  console.error("ERROR: BINANCE_API_KEY o BINANCE_SECRET_KEY no están definidos en .env.local");
  throw new Error("Las claves API de Binance no están configuradas.");
}

const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: SECRET_KEY,
});

/**
 * Manejador de la petición GET para realizar una compra de criptomonedas en Binance.
 * ACCESO: ¡¡PELIGROSO!! http://localhost:9002/api/binance/trade/buy?symbol=BTCUSDT&quoteOrderQty=0.081
 *
 * NOTA: LA CANTIDAD DE 0.081 USDT FALLARÁ POR EL MIN_NOTIONAL DE BINANCE.
 * Para una compra exitosa, usar una cantidad como 5.0 o 10.0 (ej: &quoteOrderQty=5.0)
 */
export async function GET(request: Request) { // CAMBIO CLAVE: POST a GET
  // --- CORRECCIÓN 2: Declarar variables fuera del try para que sean accesibles en el catch
  let symbol: string | null = null;
  let quoteOrderQty: string | null = null;
  let quantity: string | null = null;

  try {
    // Obtenemos los parámetros de la URL
    const { searchParams } = new URL(request.url);
    symbol = searchParams.get('symbol');
    quoteOrderQty = searchParams.get('quoteOrderQty');
    quantity = searchParams.get('quantity'); // También se podría usar para órdenes por cantidad

    if (!symbol) {
      return NextResponse.json({ message: "El 'symbol' es requerido para la operación de compra." }, { status: 400 });
    }

    if (!quoteOrderQty && !quantity) {
        return NextResponse.json({ message: "Se requiere 'quoteOrderQty' (cantidad en la moneda base) o 'quantity' (cantidad del activo a comprar)." }, { status: 400 });
    }
    if (quoteOrderQty && quantity) {
        return NextResponse.json({ message: "Solo se puede especificar 'quoteOrderQty' o 'quantity', no ambos." }, { status: 400 });
    }

    console.log(`[API/Binance/Trade/Buy] Intentando realizar compra para el símbolo: ${symbol}`);

    let orderResult;

    if (quoteOrderQty) {
        console.log(`[API/Binance/Trade/Buy] Tipo: Compra a Mercado (GET) - Gastar ${quoteOrderQty} en ${symbol}`);
        // --- CORRECCIÓN 1: Pasar 'undefined' en lugar de 'null' al segundo parámetro
        // 'undefined' es a menudo preferido para parámetros opcionales en TypeScript/JavaScript
        orderResult = await binance.marketBuy(symbol, undefined, { type: 'MARKET', quoteOrderQty: parseFloat(quoteOrderQty) });
    } else if (quantity) {
        console.log(`[API/Binance/Trade/Buy] Tipo: Compra a Mercado (GET) - Comprar ${quantity} de ${symbol}`);
        orderResult = await binance.marketBuy(symbol, parseFloat(quantity));
    }

    console.log("[API/Binance/Trade/Buy] Resultado de la orden de compra (RAW):");
    console.log(JSON.stringify(orderResult, null, 2));

    if (orderResult && orderResult.status === 'FILLED') {
      return NextResponse.json(
        {
          message: `Compra exitosa para ${symbol}.`,
          order: {
            symbol: orderResult.symbol,
            orderId: orderResult.orderId,
            clientOrderId: orderResult.clientOrderId,
            fills: orderResult.fills,
            status: orderResult.status,
            transactTime: orderResult.transactTime
          }
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          message: `La orden de compra para ${symbol} no fue FILLED completamente o hubo un problema.`,
          order: orderResult
        },
        { status: 202 }
      );
    }

  } catch (error: any) {
    console.error("[API/Binance/Trade/Buy] Error al realizar la compra:", error);

    let errorMessage = "Error desconocido al realizar la compra en Binance.";
    let statusCode = 500;

    if (error.code) {
        if (error.code === -2010) {
            errorMessage = "Fondos insuficientes para realizar la compra.";
            statusCode = 400;
        } else if (error.code === -1013) {
            // El 'symbol' ahora está disponible en el catch
            errorMessage = `Cantidad o precio inválido para el símbolo ${symbol || 'desconocido'}. Detalles: ${error.msg}`;
            statusCode = 400;
        } else {
            errorMessage = `Error de la API de Binance ${error.code}: ${error.msg || error.message}`;
        }
    } else if (error.response && error.response.data && error.response.data.msg) {
      errorMessage = `Error de la API de Binance: ${error.response.data.msg}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { message: errorMessage, error: errorMessage },
      { status: statusCode }
    );
  }
}