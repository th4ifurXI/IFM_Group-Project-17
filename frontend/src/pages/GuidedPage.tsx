import { useEffect, useState, type ReactNode } from "react";

import { api, type ComputeResponse, type Inputs } from "../api";
import { ErrorBox, Tex, VerdictCard } from "../components/common";
import { fc, fx, pct, rm } from "../format";

function Step({ n, title, open = false, children }: { n: number; title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="step" open={open}>
      <summary><span className="step-n">{n}</span>{title}</summary>
      <div className="step-body">{children}</div>
    </details>
  );
}

const Meaning = ({ children }: { children: ReactNode }) => <div className="alert alert-info">{children}</div>;

interface Props {
  scenario1: Inputs;
  mine: Inputs;
}

export default function GuidedPage({ scenario1, mine }: Props) {
  const [useMine, setUseMine] = useState(false);
  const g = useMine ? mine : scenario1;
  const [data, setData] = useState<ComputeResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.compute(g).then((d) => live && setData(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [g]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p className="caption">Loading...</p>;

  const r = data.result;
  const cur = g.currency;
  const t = (g.months / 12).toFixed(2);
  const d4 = (v: number) => v.toFixed(4);

  return (
    <section>
      <h2>Step-by-step worked example</h2>
      <div className="segmented" role="radiogroup">
        <button className={!useMine ? "active" : ""} onClick={() => setUseMine(false)}>Scenario 1 (worked example)</button>
        <button className={useMine ? "active" : ""} onClick={() => setUseMine(true)}>My plan inputs</button>
      </div>
      <p className="caption">
        {fc(g.cost_foreign, cur)} total cost, {g.months} months (t = {t} years), spot {fx(g.spot)} MYR per {cur},
        i_MY {pct(g.i_my)}, i_f {pct(g.i_f)}, inflation MY {pct(g.pi_my)}, inflation abroad {pct(g.pi_f)}.
      </p>

      <Step n={1} title="How much will it cost abroad when you leave?" open>
        <Tex expr={String.raw`Cost_t = Cost_0 \times (1 + \pi_f)^t`} />
        <p>= {g.cost_foreign.toLocaleString("en-US", { minimumFractionDigits: 2 })} x (1 + {d4(g.pi_f)})^{t} = <strong>{fc(r.cost_at_departure_foreign, cur)}</strong></p>
        <Meaning>Prices abroad rise with foreign inflation, so your {cur} budget grows before you even leave.</Meaning>
      </Step>

      <Step n={2} title="What exchange rate does PPP expect?">
        <Tex expr={String.raw`S_t = S_0 \times \left(\frac{1 + \pi_{MY}}{1 + \pi_f}\right)^t`} />
        <p>= {fx(g.spot)} x ((1 + {d4(g.pi_my)}) / (1 + {d4(g.pi_f)}))^{t} = <strong>{fx(r.ppp_expected_rate)} MYR per {cur}</strong></p>
        <Meaning>Purchasing Power Parity: the currency with higher inflation is expected to weaken. Here the rate moves with the inflation gap.</Meaning>
      </Step>

      <Step n={3} title="How many ringgit will you need if you convert later?">
        <Tex expr={String.raw`MYR_{later} = Cost_t \times S_t`} />
        <p>= {fc(r.cost_at_departure_foreign, cur)} x {fx(r.ppp_expected_rate)} = <strong>{rm(r.myr_needed_if_convert_later)}</strong></p>
        <Meaning>This is the ringgit amount you must have on departure day if you wait and convert at the PPP-expected rate.</Meaning>
      </Step>

      <Step n={4} title="What is that worth in today's money?">
        <Tex expr={String.raw`PV_{later} = \frac{MYR_{later}}{(1 + i_{MY})^t}`} />
        <p>= {rm(r.myr_needed_if_convert_later)} / (1 + {d4(g.i_my)})^{t} = <strong>{rm(r.pv_convert_later)}</strong></p>
        <Meaning>Your savings earn Malaysian interest while you wait, so you need less than that amount today.</Meaning>
      </Step>

      <Step n={5} title="What if you convert now instead?">
        <Tex expr={String.raw`PV_{now} = \frac{Cost_t}{(1 + i_f)^t} \times S_0`} />
        <p>= {fc(r.cost_at_departure_foreign, cur)} / (1 + {d4(g.i_f)})^{t} x {fx(g.spot)} = {fc(r.foreign_needed_today, cur)} x {fx(g.spot)} = <strong>{rm(r.pv_convert_now)}</strong></p>
        <Meaning>Buy {cur} today and let it earn foreign interest until you leave. Compare this with Step 4: the smaller number is the cheaper plan.</Meaning>
      </Step>

      <Step n={6} title="IRP check: does a forward contract give the same answer?">
        <Tex expr={String.raw`F = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t`} />
        <p>F = {fx(g.spot)} x ((1 + {d4(g.i_my)}) / (1 + {d4(g.i_f)}))^{t} = <strong>{fx(r.irp_forward_rate)}</strong><br />
          MYR with forward = {rm(r.myr_needed_with_forward)}, PV = <strong>{rm(r.pv_forward)}</strong> vs PV now {rm(r.pv_convert_now)}</p>
        <Meaning>Interest Rate Parity: locking a forward rate costs the same as converting now and saving abroad, so there is no free lunch. The IFE uses the same formula to predict the future spot rate.</Meaning>
      </Step>

      <Step n={7} title="Fisher Effect: are your savings growing in real terms?">
        <Tex expr={String.raw`r = \frac{1 + i}{1 + \pi} - 1`} />
        <p>Malaysia: (1 + {d4(g.i_my)}) / (1 + {d4(g.pi_my)}) - 1 = <strong>{pct(r.real_rate_my)}</strong><br />
          {cur}: (1 + {d4(g.i_f)}) / (1 + {d4(g.pi_f)}) - 1 = <strong>{pct(r.real_rate_foreign)}</strong></p>
        <Meaning>The real rate is what your money gains after inflation. A negative real rate means your savings lose buying power.</Meaning>
      </Step>

      <h3>Verdict</h3>
      <VerdictCard r={r} />
    </section>
  );
}
