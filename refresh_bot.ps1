$ErrorActionPreference = 'Stop'

$publishRoot = 'C:\BinanceTradingBot_V2'
$reportFilePath = Join-Path $publishRoot 'reports\trade-performance-report.csv'
$openTradesFilePath = Join-Path $publishRoot 'state\open-trades.json'
$botStateFilePath = Join-Path $publishRoot 'state\bot-state.json'

Write-Host 'Resetting report and state files...'

New-Item -ItemType Directory -Force -Path (Join-Path $publishRoot 'reports') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publishRoot 'state') | Out-Null

@'
SetupId,BracketId,StrategyId,Symbol,Session,Direction,EntryPrice,StopLossPrice,TakeProfitPrice,RiskRewardRatio,ExecutionMode,OpenedAt,ClosedAt,OutcomeStatus
'@ | Set-Content $reportFilePath

'[]' | Set-Content $openTradesFilePath

@'
{
  "recentOrders": []
}
'@ | Set-Content $botStateFilePath

Write-Host 'Refresh completed.'
Write-Host 'Reset files:'
Write-Host " - $reportFilePath"
Write-Host " - $openTradesFilePath"
Write-Host " - $botStateFilePath"
