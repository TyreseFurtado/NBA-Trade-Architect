import { TeamTradePayload } from '../src/types/trade';
import { TradeValidationResult, TeamTradeValidation, ApronStatus } from '../logic/cba';

export const CBA_2026 = {
    cap: 141_000_000,
    tax: 171_300_000,
    apron1: 178_700_000,
    apron2: 188_900_000,
} as const;


// Helps keep our logic blocks clean from messy string math
const fmt = (money: number) => `$${(money / 1_000_000).toFixed(1)}M`;

const getApronStatus = (payroll: number): ApronStatus => {
    if (payroll > CBA_2026.apron2) return 'SECOND_APRON';
    if (payroll > CBA_2026.apron1) return 'FIRST_APRON';
    if (payroll > CBA_2026.tax) return 'TAXABLE';
    return 'BELOW_CAP';
};


export function validateTrade(teams: TeamTradePayload[]): TradeValidationResult {

    // Functional mapping instead of mutating an array with .push()
    const teamValidations = teams.map((team): TeamTradeValidation => {
        const violations: string[] = [];

        const salaryOut = team.sending.reduce((sum: number, p) => sum + p.salary, 0);
        const salaryIn = team.receiving?.reduce((sum: number, p) => sum + p.salary, 0) || 0;

        const preTradePayroll = team.currentPayroll || 165_000_000;
        const postTradePayroll = preTradePayroll - salaryOut + salaryIn;
        const apronStatus = getApronStatus(postTradePayroll);

        const isFirstApronOrHigher = ['FIRST_APRON', 'SECOND_APRON'].includes(apronStatus);

        // RULE 1: 2nd Apron cannot aggregate salaries
        if (apronStatus === 'SECOND_APRON' && team.sending.length > 1) {
            violations.push(`${team.name} is in the 2nd Apron and cannot aggregate multiple outgoing salaries.`);
        }

        // RULE 2: BOTH Aprons forbid taking back more money than sent
        if (isFirstApronOrHigher && salaryIn > salaryOut) {
            const level = apronStatus === 'SECOND_APRON' ? '2nd' : '1st';
            violations.push(`${team.name} is hard-capped at the ${level} Apron and cannot take back excess salary (${fmt(salaryIn)} in vs ${fmt(salaryOut)} out).`);
        }

        // RULE 3: Standard 125% + $250k matching (Only applies if below aprons and operating over the cap)
        if (!isFirstApronOrHigher && postTradePayroll > CBA_2026.cap) {
            const maxAllowedIn = (salaryOut * 1.25) + 250_000;
            if (salaryIn > maxAllowedIn) {
                violations.push(`${team.name} exceeds standard matching (Max allowed: ${fmt(maxAllowedIn)}, Incoming: ${fmt(salaryIn)}).`);
            }
        }

        return {
            teamId: team.id || team.name,
            teamName: team.name,
            preTradePayroll,
            postTradePayroll,
            apronStatus,
            salaryOut,
            salaryIn,
            isLegal: violations.length === 0,
            violations,
        };
    });

    return {
        // 💡 Derives overall validity instantly without tracking a mutating variable
        isValid: teamValidations.every((t) => t.isLegal),
        teamValidations,
    };
}
