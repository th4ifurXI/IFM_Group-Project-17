import { useEffect, useState, type ReactNode } from "react";

import { api, type ComputeResponse, type Inputs } from "../api";
import { ErrorBox, Tex, VerdictCard } from "../components/common";
import { fc, fx, pct, rm } from "../format";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  const g0 = t.guided;
  const [useMine, setUseMine] = useState(false);
  const g = useMine ? mine : scenario1;
  const [data, setData] = useState<ComputeResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.compute(g).then((d) => { if (live) { setData(d); setError(""); } }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [g]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p className="caption">{g0.loading}</p>;

  const r = data.result;
  const cur = g.currency;
  const t2 = (g.months / 12).toFixed(2);
  const d4 = (v: number) => v.toFixed(4);

  return (
    <section className="guided">
      <div className="segmented" role="radiogroup">
        <button className={!useMine ? "active" : ""} onClick={() => setUseMine(false)}>{g0.scenario1}</button>
        <button className={useMine ? "active" : ""} onClick={() => setUseMine(true)}>{g0.mine}</button>
      </div>
      <p className="caption">
        {g0.caption(fc(g.cost_foreign, cur), g.months, t2, fx(g.spot), cur, pct(g.i_my), pct(g.i_f), pct(g.pi_my), pct(g.pi_f))}
      </p>

      <Step n={1} title={g0.s1} open>
        <Tex expr={String.raw`Cost_t = Cost_0 \times (1 + \pi_f)^t`} />
        <p>= {g.cost_foreign.toLocaleString("en-US", { minimumFractionDigits: 2 })} x (1 + {d4(g.pi_f)})^{t2} = <strong>{fc(r.cost_at_departure_foreign, cur)}</strong></p>
        <Meaning>{g0.m1(cur)}</Meaning>
      </Step>

      <Step n={2} title={g0.s2}>
        <Tex expr={String.raw`S_t = S_0 \times \left(\frac{1 + \pi_{MY}}{1 + \pi_f}\right)^t`} />
        <p>= {fx(g.spot)} x ((1 + {d4(g.pi_my)}) / (1 + {d4(g.pi_f)}))^{t2} = <strong>{fx(r.ppp_expected_rate)} {g0.perCur(cur)}</strong></p>
        <Meaning>{g0.m2}</Meaning>
      </Step>

      <Step n={3} title={g0.s3}>
        <Tex expr={String.raw`MYR_{later} = Cost_t \times S_t`} />
        <p>= {fc(r.cost_at_departure_foreign, cur)} x {fx(r.ppp_expected_rate)} = <strong>{rm(r.myr_needed_if_convert_later)}</strong></p>
        <Meaning>{g0.m3}</Meaning>
      </Step>

      <Step n={4} title={g0.s4}>
        <Tex expr={String.raw`PV_{later} = \frac{MYR_{later}}{(1 + i_{MY})^t}`} />
        <p>= {rm(r.myr_needed_if_convert_later)} / (1 + {d4(g.i_my)})^{t2} = <strong>{rm(r.pv_convert_later)}</strong></p>
        <Meaning>{g0.m4}</Meaning>
      </Step>

      <Step n={5} title={g0.s5}>
        <Tex expr={String.raw`PV_{now} = \frac{Cost_t}{(1 + i_f)^t} \times S_0`} />
        <p>= {fc(r.cost_at_departure_foreign, cur)} / (1 + {d4(g.i_f)})^{t2} x {fx(g.spot)} = {fc(r.foreign_needed_today, cur)} x {fx(g.spot)} = <strong>{rm(r.pv_convert_now)}</strong></p>
        <Meaning>{g0.m5(cur)}</Meaning>
      </Step>

      <Step n={6} title={g0.s6}>
        <Tex expr={String.raw`F = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t`} />
        <p>F = {fx(g.spot)} x ((1 + {d4(g.i_my)}) / (1 + {d4(g.i_f)}))^{t2} = <strong>{fx(r.irp_forward_rate)}</strong><br />
          {g0.l6(rm(r.myr_needed_with_forward), rm(r.pv_forward), rm(r.pv_convert_now))}</p>
        <Meaning>{g0.m6}</Meaning>
      </Step>

      <Step n={7} title={g0.s7}>
        <Tex expr={String.raw`r = \frac{1 + i}{1 + \pi} - 1`} />
        <p>Malaysia: (1 + {d4(g.i_my)}) / (1 + {d4(g.pi_my)}) - 1 = <strong>{pct(r.real_rate_my)}</strong><br />
          {cur}: (1 + {d4(g.i_f)}) / (1 + {d4(g.pi_f)}) - 1 = <strong>{pct(r.real_rate_foreign)}</strong></p>
        <Meaning>{g0.m7}</Meaning>
      </Step>

      <h3>{g0.verdictTitle}</h3>
      <VerdictCard r={r} />
    </section>
  );
}
