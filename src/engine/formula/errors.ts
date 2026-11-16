export type FormulaErrorCode =
  | 'SYNTAX'
  | 'UNKNOWN_VARIABLE'
  | 'UNKNOWN_FUNCTION'
  | 'ARITY'
  | 'TYPE'
  | 'DIV_ZERO'
  | 'CYCLE'
  | 'DEPENDENCY';

export class FormulaError extends Error {
  constructor(
    public code: FormulaErrorCode,
    message: string,
    /** posição (índice de caractere) no texto da fórmula, quando conhecida */
    public pos?: number,
    public length: number = 1,
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}
