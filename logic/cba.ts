export interface CBACapThresholds {
    salaryCap: number;
    luxuryTax: number;
    firstApron: number;
    secondApron: number;
}

export type ApronStatus = 'BELOW_CAP' | 'TAXABLE' | 'FIRST_APRON' | 'SECOND_APRON';

export interface TeamTradeValidation {
    teamId: string;
    teamName: string;
    preTradePayroll: number;
    postTradePayroll: number;
    apronStatus: ApronStatus;
    salaryOut: number;
    salaryIn: number;
    isLegal: boolean;
    violations: string[];
}

export interface TradeValidationResult {
    isValid: boolean;
    teamValidations: TeamTradeValidation[];
}