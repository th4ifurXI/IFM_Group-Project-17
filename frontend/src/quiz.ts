// Quiz questions in English and Bahasa Melayu.
// Concept questions use numbers already verified in our scenario table.
// "Your plan" questions take every number from the finance engine's result:
// the options are different engine outputs, so the frontend calculates nothing.

import type { Inputs, Result } from "./api";
import { fc, fx, pct, rm } from "./format";
import { verdictKey, type Lang } from "./i18n";

export type Topic = "PPP" | "IRP" | "Fisher" | "IFE" | "plan";

export interface Question {
  id: string;
  topic: Topic;
  prompt: string;
  options: string[];
  answer: number; // index into options
  explain: string;
}

interface Concept { prompt: string; options: string[]; answer: number; explain: string; topic: Topic }

const CONCEPTS: Record<Lang, Concept[]> = {
  en: [
    {
      topic: "PPP", answer: 1,
      prompt: "Malaysian inflation rises from 2% to 4%, while UK inflation stays at 3%. Under PPP, what happens to the ringgit?",
      options: ["It strengthens against the pound", "It weakens against the pound", "It stays the same"],
      explain: "PPP says the currency with higher inflation loses buying power, so it weakens. In our app the expected rate rises from 5.7437 to 5.8563 MYR per GBP.",
    },
    {
      topic: "Fisher", answer: 2,
      prompt: "Your bank pays 3% a year and Malaysian inflation is 4%. What is your real interest rate?",
      options: ["+7.00%", "+1.00%", "-0.96%"],
      explain: "Fisher Effect: real rate = (1 + 3%) / (1 + 4%) - 1 = -0.96%. Prices rise faster than your interest, so your savings lose buying power.",
    },
    {
      topic: "IRP", answer: 1,
      prompt: "Under Interest Rate Parity, locking in a forward contract, compared with converting now and saving abroad, costs...",
      options: ["More", "The same", "Less"],
      explain: "IRP says the forward rate exactly reflects the interest rate gap, so there is no free profit. In our worked example both cost RM114,884.62 in today's money.",
    },
    {
      topic: "IFE", answer: 1,
      prompt: "Under the International Fisher Effect, the currency with the higher interest rate is expected to...",
      options: ["Strengthen", "Weaken", "Not change"],
      explain: "A higher interest rate usually reflects higher expected inflation, so IFE expects that currency to weaken by roughly the interest rate gap.",
    },
    {
      topic: "Fisher", answer: 0,
      prompt: "Savings abroad earn a higher real interest rate than savings in Malaysia. What should the student do?",
      options: ["Convert now", "Convert later", "It doesn't matter"],
      explain: "Money grows faster in real terms abroad, so converting now and saving there is cheaper. Scenario 2 in the app shows this: converting now saves RM2,241.60.",
    },
    {
      topic: "Fisher", answer: 2,
      prompt: "Malaysian inflation is 4%, and the Malaysian savings rate rises to 5.01% so both countries give the same real return. What is the verdict?",
      options: ["Convert now", "Convert later", "Either"],
      explain: "When real rates are equal (the Fisher Effect holds), interest exactly offsets the expected exchange-rate move, so timing stops mattering.",
    },
  ],
  ms: [
    {
      topic: "PPP", answer: 1,
      prompt: "Inflasi Malaysia naik daripada 2% kepada 4%, manakala inflasi UK kekal 3%. Mengikut PPP, apa yang berlaku kepada ringgit?",
      options: ["Ringgit mengukuh berbanding pound", "Ringgit melemah berbanding pound", "Ringgit tidak berubah"],
      explain: "PPP menyatakan mata wang dengan inflasi lebih tinggi kehilangan kuasa beli, jadi ia melemah. Dalam aplikasi kami, kadar jangkaan naik daripada 5.7437 kepada 5.8563 MYR per GBP.",
    },
    {
      topic: "Fisher", answer: 2,
      prompt: "Bank anda membayar 3% setahun dan inflasi Malaysia ialah 4%. Berapakah kadar faedah benar anda?",
      options: ["+7.00%", "+1.00%", "-0.96%"],
      explain: "Kesan Fisher: kadar benar = (1 + 3%) / (1 + 4%) - 1 = -0.96%. Harga naik lebih cepat daripada faedah anda, jadi simpanan anda kehilangan kuasa beli.",
    },
    {
      topic: "IRP", answer: 1,
      prompt: "Mengikut Pariti Kadar Faedah, mengunci kontrak hadapan, berbanding tukar sekarang dan simpan di luar negara, berkos...",
      options: ["Lebih tinggi", "Sama", "Lebih rendah"],
      explain: "IRP menyatakan kadar hadapan mencerminkan jurang kadar faedah dengan tepat, jadi tiada untung percuma. Dalam contoh kiraan kami, kedua-duanya berkos RM114,884.62 dalam nilai wang hari ini.",
    },
    {
      topic: "IFE", answer: 1,
      prompt: "Mengikut Kesan Fisher Antarabangsa, mata wang dengan kadar faedah lebih tinggi dijangka...",
      options: ["Mengukuh", "Melemah", "Tidak berubah"],
      explain: "Kadar faedah yang lebih tinggi biasanya mencerminkan jangkaan inflasi yang lebih tinggi, jadi IFE menjangkakan mata wang itu melemah kira-kira sebanyak jurang kadar faedah.",
    },
    {
      topic: "Fisher", answer: 0,
      prompt: "Simpanan di luar negara memberi kadar faedah benar yang lebih tinggi berbanding simpanan di Malaysia. Apa yang patut pelajar lakukan?",
      options: ["Tukar sekarang", "Tukar kemudian", "Tidak penting"],
      explain: "Wang berkembang lebih cepat dalam nilai benar di luar negara, jadi tukar sekarang dan simpan di sana lebih murah. Senario 2 dalam aplikasi menunjukkan ini: tukar sekarang menjimatkan RM2,241.60.",
    },
    {
      topic: "Fisher", answer: 2,
      prompt: "Inflasi Malaysia ialah 4%, dan kadar simpanan Malaysia naik kepada 5.01% supaya kedua-dua negara memberi pulangan benar yang sama. Apakah keputusannya?",
      options: ["Tukar sekarang", "Tukar kemudian", "Mana-mana pun"],
      explain: "Apabila kadar benar sama (Kesan Fisher berlaku), faedah mengimbangi sepenuhnya jangkaan perubahan kadar pertukaran, jadi masa tidak lagi penting.",
    },
  ],
};

const PLAN_TEXT = {
  en: {
    readyQ: (cost: string, m: number) => `For your plan (${cost}, ${m} months), how much ringgit should you have ready on departure day if you convert when you leave?`,
    readyE: (atDep: string, ppp: string) => `It is the cost at departure (${atDep}) times the PPP expected rate (${ppp}). The other two are present values: costs in today's money, not the cash you need on the day.`,
    rateQ: (spot: string, cur: string) => `Today's rate is RM${spot} per ${cur}. What rate does PPP expect when you leave?`,
    rateE: (my: string, f: string, irp: string) => `PPP adjusts today's rate by the inflation gap between Malaysia (${my}) and abroad (${f}). RM${irp} is the IRP forward rate, which uses interest rates instead.`,
    verdictQ: "What is the verdict for your plan?",
    verdictE: (now: string, later: string) => `Converting now costs ${now} and converting later costs ${later} in today's money.`,
    tail: { now: " Converting now is cheaper.", later: " Converting later is cheaper.", either: " They are within 0.5% of each other, so either works." },
    verdicts: ["Convert now", "Convert later", "Either"],
  },
  ms: {
    readyQ: (cost: string, m: number) => `Untuk pelan anda (${cost}, ${m} bulan), berapa banyak ringgit yang perlu anda sediakan pada hari berlepas jika anda tukar semasa berlepas?`,
    readyE: (atDep: string, ppp: string) => `Ia ialah kos semasa berlepas (${atDep}) didarab dengan kadar jangkaan PPP (${ppp}). Dua pilihan lain ialah nilai kini: kos dalam nilai wang hari ini, bukan tunai yang anda perlukan pada hari itu.`,
    rateQ: (spot: string, cur: string) => `Kadar hari ini ialah RM${spot} per ${cur}. Apakah kadar yang dijangka oleh PPP semasa anda berlepas?`,
    rateE: (my: string, f: string, irp: string) => `PPP melaraskan kadar hari ini mengikut jurang inflasi antara Malaysia (${my}) dan luar negara (${f}). RM${irp} ialah kadar hadapan IRP, yang menggunakan kadar faedah.`,
    verdictQ: "Apakah keputusan untuk pelan anda?",
    verdictE: (now: string, later: string) => `Tukar sekarang berkos ${now} dan tukar kemudian berkos ${later} dalam nilai wang hari ini.`,
    tail: { now: " Tukar sekarang lebih murah.", later: " Tukar kemudian lebih murah.", either: " Perbezaannya dalam lingkungan 0.5%, jadi mana-mana pun boleh." },
    verdicts: ["Tukar sekarang", "Tukar kemudian", "Mana-mana pun"],
  },
};

export function buildQuiz(lang: Lang, inputs: Inputs, r: Result): Question[] {
  const concept: Question[] = CONCEPTS[lang].map((c, i) => ({ id: `c${i + 1}`, ...c }));
  const p = PLAN_TEXT[lang];
  const cur = inputs.currency;
  const v = verdictKey(r.verdict);
  const plan: Question[] = [
    {
      id: "p1", topic: "plan",
      prompt: p.readyQ(fc(inputs.cost_foreign, cur), inputs.months),
      options: [rm(r.pv_convert_now), rm(r.myr_needed_if_convert_later), rm(r.pv_convert_later)],
      answer: 1,
      explain: p.readyE(fc(r.cost_at_departure_foreign, cur), fx(r.ppp_expected_rate)),
    },
    {
      id: "p2", topic: "plan",
      prompt: p.rateQ(fx(inputs.spot), cur),
      options: [`RM${fx(inputs.spot)}`, `RM${fx(r.ppp_expected_rate)}`, `RM${fx(r.irp_forward_rate)}`],
      answer: 1,
      explain: p.rateE(pct(inputs.pi_my), pct(inputs.pi_f), fx(r.irp_forward_rate)),
    },
    {
      id: "p3", topic: "plan",
      prompt: p.verdictQ,
      options: p.verdicts,
      answer: v === "now" ? 0 : v === "later" ? 1 : 2,
      explain: p.verdictE(rm(r.pv_convert_now), rm(r.pv_convert_later)) + p.tail[v],
    },
  ];
  return [...concept, ...plan];
}
