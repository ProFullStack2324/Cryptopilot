
import sys
import json
import pandas as pd
import pandas_ta as ta

def calculate_indicators(data):
    try:
        df = pd.DataFrame(data)
        # Asegurar tipos numéricos
        cols = ['openPrice', 'highPrice', 'lowPrice', 'closePrice', 'volume']
        for col in cols:
            df[col] = pd.to_numeric(df[col])
            
        # Calcular indicadores con pandas_ta (Filtros Deterministas)
        df.ta.sma(length=50, append=True)
        df.ta.rsi(length=14, append=True)
        df.ta.macd(fast=12, slow=26, signal=9, append=True)
        df.ta.bbands(length=20, std=2, append=True)
        df.ta.atr(length=14, append=True)
        df.ta.adx(length=14, append=True)
        
        # Formatear salida
        result = df.to_dict(orient='records')
        return result
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    try:
        # Leer datos de STDIN (enviados desde Node.js)
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input data received"}))
            sys.exit(1)
            
        data = json.loads(input_data)
        indicators = calculate_indicators(data)
        print(json.dumps(indicators))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
