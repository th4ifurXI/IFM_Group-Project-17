import { Tex } from "../components/common";

const FORMULAS = [
  ["Foreign cost growth", String.raw`Cost_t = Cost_0 \times (1 + \pi_f)^t`, "What the trip will cost abroad on departure day."],
  ["Purchasing Power Parity (PPP)", String.raw`S_t = S_0 \times \left(\frac{1 + \pi_{MY}}{1 + \pi_f}\right)^t`, "Expected future spot rate: the higher-inflation currency weakens."],
  ["Interest Rate Parity (IRP)", String.raw`F = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t`, "Fair forward rate: a forward contract costs the same as converting now and saving abroad."],
  ["International Fisher Effect (IFE)", String.raw`E[S_t] = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t`, "Interest rate gaps predict currency moves (same form as IRP)."],
  ["Fisher Effect (exact real rate)", String.raw`r = \frac{1 + i}{1 + \pi} - 1`, "What savings really earn after inflation."],
  ["Present value", String.raw`PV = \frac{FV}{(1 + i_{MY})^t}`, "Turns a future MYR amount into today's ringgit so options compare fairly."],
];

const GLOSSARY = [
  ["Spot rate", "Today's exchange rate, in MYR per 1 foreign unit."],
  ["Forward rate", "A rate agreed today for exchanging money on a future date."],
  ["Inflation", "How fast prices rise each year."],
  ["Nominal interest rate", "The rate the bank quotes before inflation."],
  ["Real interest rate", "Growth in buying power after inflation (Fisher)."],
  ["Present value (PV)", "A future amount expressed in today's money."],
  ["Appreciate / depreciate", "A currency getting stronger / weaker."],
  ["PPP", "Exchange rates adjust so the same basket costs the same everywhere."],
  ["IRP", "Forward rates reflect interest rate gaps, so there is no free profit."],
  ["IFE", "The higher-interest currency is expected to weaken by the rate gap."],
];

export default function LearnPage() {
  return (
    <section className="learn">
      <h2>Formulas used by the finance engine</h2>
      <p className="caption">Exchange rates are MYR per 1 unit of foreign currency. Rates are annual decimals
        compounded once a year; t = months / 12.</p>
      <div className="grid-2">
        {FORMULAS.map(([name, tex, meaning]) => (
          <div className="card" key={name}>
            <strong>{name}</strong>
            <Tex expr={tex} />
            <p className="caption">{meaning}</p>
          </div>
        ))}
      </div>

      <h3>How the verdict is decided</h3>
      <ul>
        <li><strong>Convert later:</strong> keep MYR at the Malaysian rate, convert on departure at the PPP-expected rate, discount back to today.</li>
        <li><strong>Convert now:</strong> buy just enough foreign currency today that, saved at the foreign rate, covers the inflated cost.</li>
        <li>If the two present values are within 0.5% the verdict is <strong>Either</strong>; otherwise the cheaper one wins.</li>
        <li>Rule of thumb: the verdict follows the Fisher real-rate gap. A higher real rate abroad means convert now; a higher real rate in Malaysia means convert later.</li>
      </ul>

      <div className="grid-2">
        <div>
          <h3>Assumptions</h3>
          <ul>
            <li>Rates and inflation stay constant until departure.</li>
            <li>PPP holds on average over the horizon.</li>
            <li>Interest is compounded once a year; no taxes.</li>
            <li>No bank fees, FX spreads or transfer costs.</li>
            <li>The whole budget is converted in one go.</li>
          </ul>
        </div>
        <div>
          <h3>Limitations</h3>
          <ul>
            <li>PPP and IFE often fail in the short run; real exchange rates are volatile.</li>
            <li>All rates in this app are illustrative, not market data.</li>
            <li>Students may not access foreign savings accounts or forward contracts in practice.</li>
            <li>This is a learning tool, not financial advice.</li>
          </ul>
        </div>
      </div>

      <h3>Glossary</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
          <tbody>{GLOSSARY.map(([t, m]) => <tr key={t}><td><strong>{t}</strong></td><td>{m}</td></tr>)}</tbody>
        </table>
      </div>

      <h3>References</h3>
      <ul>
        <li>Madura, J. <em>International Financial Management</em>. Cengage Learning (course textbook).</li>
        <li>Bank Negara Malaysia. Interest rate and exchange rate statistics. <a href="https://www.bnm.gov.my" target="_blank" rel="noreferrer">bnm.gov.my</a></li>
        <li>Department of Statistics Malaysia. Consumer Price Index releases. <a href="https://www.dosm.gov.my" target="_blank" rel="noreferrer">dosm.gov.my</a></li>
        <li>International Monetary Fund. World Economic Outlook database. <a href="https://www.imf.org" target="_blank" rel="noreferrer">imf.org</a></li>
      </ul>

      <h3>AI-use disclosure</h3>
      <div className="alert alert-info">[Placeholder: describe how your group used AI tools in building this project,
        for example code assistance and the Gemini-powered coach, and how outputs were checked against finance.py.]</div>
    </section>
  );
}
