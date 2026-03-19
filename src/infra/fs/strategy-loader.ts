import fs from 'node:fs';
import path from 'node:path';
import { StrategyDefinition } from '../../core/types';

export class StrategyLoader {
  public constructor(private readonly strategiesDirectoryPath: string) {}

  public loadById(strategyId: string): StrategyDefinition {
    const strategyFiles = fs.readdirSync(this.strategiesDirectoryPath)
      .filter((fileName) => fileName.endsWith('.json'));

    for (const fileName of strategyFiles) {
      const fullPath = path.join(this.strategiesDirectoryPath, fileName);
      const strategy = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as StrategyDefinition;
      if (strategy.id === strategyId) {
        return strategy;
      }
    }

    throw new Error(`Strategy '${strategyId}' was not found in ${this.strategiesDirectoryPath}.`);
  }
}
