import demoData from "../../../data/demo-data.json";

export type DemoAccount = (typeof demoData.accounts)[number];

export const demoAccounts = demoData.accounts;

export function findDemoAccount(username: string, password: string): DemoAccount | undefined {
  return demoAccounts.find(
    (account) => account.username === username.trim() && account.password === password,
  );
}
