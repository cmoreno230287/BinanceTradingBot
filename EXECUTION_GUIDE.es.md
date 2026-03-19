# Guia de Ejecucion

Esta guia explica como ejecutar `BinanceTradingBot_V2` en modo analisis, modo orden de prueba y modo orden real.

## 1. Ubicacion del Proyecto

- Ruta del proyecto: `C:\Projects\BinanceTradingBot_V2`
- Ruta esperada por defecto para Binance CLI:
  `C:\Projects\BinanceIntegration\BinanceIntegration.Cli\bin\Release\net8.0\BinanceIntegration.Cli.exe`

## 2. Prerrequisitos

Antes de ejecutar el bot, verifica:

- Node.js instalado.
- Binance Integration CLI compilado.
- El archivo `.env` existe en la raiz del proyecto.

## 3. Archivos Importantes

- `.env`: configuracion activa de ejecucion
- `strategies\*.json`: definiciones de estrategias disponibles
- `logs\`: logs de ejecucion del bot
- `state\bot-state.json`: estado para proteccion contra ordenes duplicadas
- `dist\`: salida compilada de JavaScript

## 4. Configurar el Bot

Abre `.env` y revisa estos valores:

```env
BOT_NAME=BinanceTradingBot_V2
STRATEGY_ID=strategy-1-btc-sweep
BINANCE_SYMBOL=BTCUSDT
BINANCE_BASE_URL=https://api.binance.com
BINANCE_CLI_PATH=C:\Projects\BinanceIntegration\BinanceIntegration.Cli\bin\Release\net8.0\BinanceIntegration.Cli.exe
TRADE_JOURNAL_DIR=C:\Codex\Agents\Expert_Trader\Resources\Trades
RISK_PERCENT=1
ACCOUNT_BALANCE_USD=1000
DEFAULT_QUANTITY=0.0001
MIN_QUANTITY=0.00001
MAX_QUANTITY=0.01
MAX_TRADES_PER_DAY=3
DUPLICATE_ORDER_COOLDOWN_MINUTES=90
EXECUTE_ORDERS=false
USE_TEST_ORDERS=true
ANALYSIS_INTERVAL_SECONDS=0
```

Configuraciones clave:

- `STRATEGY_ID`: selecciona la estrategia desde `strategies\`
- `EXECUTE_ORDERS=false`: solo analisis, no envia ordenes
- `EXECUTE_ORDERS=true`: habilita envio de ordenes
- `USE_TEST_ORDERS=true`: usa modo `--test` del Binance CLI
- `ANALYSIS_INTERVAL_SECONDS=0`: ejecuta una sola vez
- `ANALYSIS_INTERVAL_SECONDS=60`: ejecuta cada 60 segundos

## 5. Instalar Dependencias

Desde PowerShell:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd install
```

## 6. Compilar el Proyecto

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
```

Esto compila TypeScript hacia `dist\`.

## 7. Modos de Ejecucion

### Solo Analisis

Recomendado para validar la estrategia sin crear ordenes.

Usa:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='0'
node .\dist\index.js
```

Resultado esperado:

- El bot consulta velas en Binance
- La estrategia analiza el mercado
- Se imprime un resumen JSON
- No se envia ninguna orden

### Analisis Continuo

Ejecuta el bot continuamente con un intervalo fijo.

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='60'
node .\dist\index.js
```

Esto ejecuta un ciclo cada 60 segundos.

### Modo Orden de Prueba

Este modo permite que el bot llegue hasta la parte de ejecucion de ordenes, pero usando envio de prueba del Binance CLI.

Configura en `.env`:

```env
EXECUTE_ORDERS=true
USE_TEST_ORDERS=true
```

Luego ejecuta:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
node .\dist\index.js
```

Notas:

- Solo intentara crear una orden si la estrategia encuentra un setup valido.
- Las reglas de proteccion siguen aplicando:
  - limite diario de trades
  - cooldown de setup duplicado

### Modo Orden Real

Usa este modo solo cuando ya hayas validado toda la configuracion.

Configura en `.env`:

```env
EXECUTE_ORDERS=true
USE_TEST_ORDERS=false
```

Luego ejecuta:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
node .\dist\index.js
```

Antes de ejecutar en real:

- confirma `BINANCE_CLI_PATH`
- confirma la estrategia seleccionada
- confirma `ACCOUNT_BALANCE_USD`
- confirma `RISK_PERCENT`
- confirma limites diarios y cooldown

## 8. Seleccion de Estrategia

Las estrategias disponibles estan en:

`C:\Projects\BinanceTradingBot_V2\strategies`

Para cambiar de estrategia, modifica solo:

```env
STRATEGY_ID=strategy-1-btc-sweep-conservative
```

Luego compila y ejecuta nuevamente.

## 9. Salida y Monitoreo

### Salida en Consola

Cada ejecucion imprime un JSON con:

- informacion de la estrategia
- sesion actual
- razones de trade o no trade
- calculo de posicion
- resultado de ejecucion si aplica

### Logs

Los logs diarios se guardan en:

`C:\Projects\BinanceTradingBot_V2\logs`

Ejemplo:

- `20260319.log`

### Estado de Proteccion Contra Duplicados

El bot guarda setups enviados recientemente en:

`C:\Projects\BinanceTradingBot_V2\state\bot-state.json`

Esto evita reenviar el mismo setup dentro del cooldown configurado.

### Journal de Trades

Los registros de trades se agregan en:

`C:\Codex\Agents\Expert_Trader\Resources\Trades`

Ejemplo de archivo mensual:

- `Trades_Mar2026.csv`

## 10. Secuencia Recomendada de Ejecucion

1. Revisar `.env`
2. Ejecutar `npm.cmd run build`
3. Ejecutar primero en modo solo analisis
4. Ejecutar en modo orden de prueba
5. Cambiar a modo real solo despues de validar

## 11. Comandos Comunes

Compilar:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
```

Analisis unico:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='0'
node .\dist\index.js
```

Ejecucion continua cada 60 segundos:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='60'
node .\dist\index.js
```

## 12. Solucion de Problemas

Si `dist\index.js` no existe:

```powershell
npm.cmd run build
```

Si el bot no puede ejecutar Binance CLI:

- verifica `BINANCE_CLI_PATH`
- verifica que el ejecutable exista
- verifica que el proyecto Binance Integration este compilado

Si no se crean ordenes:

- revisa si la sesion actual esta fuera de la whitelist de la estrategia
- revisa las razones en la salida JSON
- revisa `logs\`
- revisa cooldown y limite diario

Si el tamano de posicion se ve incorrecto:

- revisa `ACCOUNT_BALANCE_USD`
- revisa `RISK_PERCENT`
- revisa `MIN_QUANTITY` y `MAX_QUANTITY`

## 13. Primera Ejecucion Segura

Para la primera ejecucion mas segura, usa:

```env
EXECUTE_ORDERS=false
USE_TEST_ORDERS=true
ANALYSIS_INTERVAL_SECONDS=0
```

Luego ejecuta:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
node .\dist\index.js
```
