import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BREEDS = ["Murrah buffalo", "Nili-Ravi buffalo"];
const SEX_OPTIONS = ["Female", "Male"];
const STATUS_OPTIONS = ["Active (present in herd)", "Dead", "Culled"];
const CALVING_OUTCOMES = ["Normal calving", "Stillbirth", "Abortion"];
const ENTRY_MODES = ["Manual", "Friday Records"];
const AI_RESULTS = ["Pending", "Negative", "Conceived"];
const FEMALE_TABS = ["pedigree", "reproduction", "calving", "production", "health", "history"];
const MALE_TABS = ["pedigree", "disease testing", "progenies born", "performance of daughters", "health", "overall history sheet"];
const HEALTH_SUBTABS = [
  { id: "bodyWeight", label: "Body Weight" },
  { id: "deworming", label: "Deworming" },
  { id: "vaccination", label: "Vaccination" },
  { id: "treatment", label: "Treatment" },
];
const COLOSTRUM_DAYS = 5;

const emptyAnimal = {
  tagNo: "",
  breed: "Nili-Ravi buffalo",
  dob: "",
  category: "Female",
  identificationMark: "",
  status: "Active (present in herd)",
  exitDate: "",
  exitReason: "",
  isBreedingBull: "No",
  breedingSet: "",
};

const emptyPedigree = {
  sire: "",
  dam: "",
  sireSire: "",
  sireDam: "",
  damSire: "",
  damDam: "",
  sireSireSire: "",
  sireSireDam: "",
  sireDamSire: "",
  sireDamDam: "",
  damSireSire: "",
  damSireDam: "",
  damDamSire: "",
  damDamDam: "",
};

function makeCalvingParity(parityNo) {
  return {
    parityNo: String(parityNo),
    calvingDate: "",
    calfSex: "",
    calfTag: "",
    calfSire: "",
    calvingOutcome: "Normal calving",
    remarks: "",
  };
}

function makeReproParity(parityNo) {
  return {
    parityNo: String(parityNo),
    conceptionDate: "",
    expectedCalvingDate: "",
    remarks: "",
    aiRecords: [],
  };
}

function makeFridayRecord(date = "") {
  return {
    date,
    morningMilk: "",
    eveningMilk: "",
    totalDailyYield: "",
    fatPct: "",
    snfPct: "",
    tsPct: "",
  };
}

function makeProductionLactation(parityNo) {
  return {
    parityNo: String(parityNo),
    entryMode: "Manual",
    calvingDate: "",
    dryDate: "",
    manualSummary: {
      totalLactationMilk: "",
      standardLactationMilk: "",
      peakYield: "",
    },
    fridayRecords: [],
  };
}

function makeBodyWeightRecord() {
  return { recordDate: "", bodyWeight: "" };
}

function makeDewormingRecord() {
  return { dewormingDate: "", anthelminticUsed: "" };
}

function makeVaccinationRecord() {
  return { vaccinationDate: "", vaccineUsed: "" };
}

function makeTreatmentRecord() {
  return { treatmentDate: "", diagnosis: "", treatmentGiven: "" };
}

function makeDiseaseTestRecord() {
  return { testDate: "", testName: "", result: "", remarks: "" };
}

const emptyHealth = {
  bodyWeightRecords: [makeBodyWeightRecord()],
  dewormingRecords: [makeDewormingRecord()],
  vaccinationRecords: [makeVaccinationRecord()],
  treatmentRecords: [makeTreatmentRecord()],
};

const emptyFemaleDetails = {
  pedigree: { ...emptyPedigree },
  calvingParities: [makeCalvingParity(1)],
  reproductionParities: [makeReproParity(0)],
  selectedReproParity: "0",
  productionLactations: [makeProductionLactation(1)],
  selectedProductionParity: "1",
  health: { ...emptyHealth },
  historyMeta: {
    reasonForCulling: "",
    bookValue: "",
  },
};

const emptyMaleDetails = {
  pedigree: { ...emptyPedigree },
  diseaseTests: [makeDiseaseTestRecord()],
  health: { ...emptyHealth },
  historyMeta: {
    remarks: "",
    bookValue: "",
  },
};

const initialAnimals = [];

function parseDisplayDate(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.trim().split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!day || !month || !year) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return dt;
}

function formatDateDisplay(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeDisplayDate(value) {
  const dt = parseDisplayDate(value);
  return dt ? formatDateDisplay(dt) : value;
}

function daysBetween(start, end) {
  const a = parseDisplayDate(start);
  const b = parseDisplayDate(end);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function addDays(dateStr, days) {
  const dt = parseDisplayDate(dateStr);
  if (!dt) return "";
  const copy = new Date(dt);
  copy.setDate(copy.getDate() + days);
  return formatDateDisplay(copy);
}

function expectedCalving(dateStr) {
  return dateStr ? addDays(dateStr, 310) : "";
}

function firstRecordableFriday(calvingDate) {
  const base = parseDisplayDate(calvingDate);
  if (!base) return "";
  for (let i = 0; i <= 14; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const candidate = formatDateDisplay(d);
    const gap = daysBetween(calvingDate, candidate);
    if (d.getDay() === 5 && gap > 5) return candidate;
  }
  return "";
}

function sortByTag(a, b) {
  const an = Number(a.tagNo);
  const bn = Number(b.tagNo);
  const aNum = Number.isFinite(an) && !Number.isNaN(an);
  const bNum = Number.isFinite(bn) && !Number.isNaN(bn);
  if (aNum && bNum) return an - bn;
  return String(a.tagNo).localeCompare(String(b.tagNo), undefined, { numeric: true, sensitivity: "base" });
}

function normalizeRomanInput(value) {
  return (value || "").toUpperCase().replace(/[^IVXLCDM]/g, "");
}

function isArchivedAnimal(animal) {
  const archivedStatus = animal?.status === "Dead" || animal?.status === "Culled";
  return archivedStatus && Boolean((animal?.exitDate || "").trim()) && Boolean((animal?.exitReason || "").trim());
}

function normalizeAnimalFormData(form) {
  const next = { ...form };
  if (next.status === "Active (present in herd)") {
    next.exitDate = "";
    next.exitReason = "";
  }
  if (next.category !== "Male") {
    next.isBreedingBull = "No";
    next.breedingSet = "";
  } else {
    next.isBreedingBull = next.isBreedingBull || "No";
    next.breedingSet = next.isBreedingBull === "Yes" ? normalizeRomanInput(next.breedingSet || "") : "";
  }
  return next;
}

function femaleHasAnyCalving(animal) {
  return Boolean(animal?.femaleDetails?.calvingParities?.some((p) => p.calvingDate));
}

function getLastNormalCalving(animal) {
  const calvings = animal?.femaleDetails?.calvingParities || [];
  const valid = calvings
    .filter((p) => p.calvingDate && (p.calvingOutcome || "Normal calving") === "Normal calving")
    .sort((a, b) => {
      const ad = parseDisplayDate(a.calvingDate);
      const bd = parseDisplayDate(b.calvingDate);
      if (!ad || !bd) return 0;
      return bd.getTime() - ad.getTime();
    });
  return valid[0] || null;
}

function getCurrentLactationDryDate(animal) {
  const lactations = animal?.femaleDetails?.productionLactations || [];
  if (!lactations.length) return "";
  const sorted = [...lactations].sort((a, b) => Number(a.parityNo) - Number(b.parityNo));
  return sorted[sorted.length - 1]?.dryDate || "";
}

function getFemaleLifecycle(animal) {
  if (!animal || animal.category !== "Female") return animal?.category || "";
  if (!femaleHasAnyCalving(animal)) return "Heifer";

  const lastCalving = getLastNormalCalving(animal);
  const previousLifecycle = animal?.preCalvingLifecycle || "Heifer";
  if (lastCalving?.calvingDate) {
    const daysSinceCalving = daysBetween(lastCalving.calvingDate, formatDateDisplay(new Date()));
    if (daysSinceCalving < COLOSTRUM_DAYS) {
      return previousLifecycle === "Heifer" ? "Colostrum-Heifer" : "Colostrum";
    }
    if (previousLifecycle === "Heifer") return "Dry";
    return "Milk";
  }

  if (getCurrentLactationDryDate(animal)) return "Dry";
  return "Milk";
}

function recalcFridayRecord(record) {
  const hasMilkEntry = record.morningMilk !== "" || record.eveningMilk !== "";
  const total = Number(record.morningMilk || 0) + Number(record.eveningMilk || 0);
  return {
    ...record,
    totalDailyYield: hasMilkEntry ? String(total) : record.totalDailyYield || "",
  };
}

function getNextFridayRecordDate(lactation) {
  const existing = lactation?.fridayRecords || [];
  if (!existing.length) return firstRecordableFriday(lactation?.calvingDate || "");
  const lastDate = existing[existing.length - 1]?.date || "";
  return lastDate ? addDays(lastDate, 7) : "";
}

function getHealthWithDefaults(health) {
  return {
    ...emptyHealth,
    ...(health || {}),
    bodyWeightRecords: health?.bodyWeightRecords?.length ? health.bodyWeightRecords.map((r) => ({ ...r })) : [makeBodyWeightRecord()],
    dewormingRecords: health?.dewormingRecords?.length ? health.dewormingRecords.map((r) => ({ ...r })) : [makeDewormingRecord()],
    vaccinationRecords: health?.vaccinationRecords?.length ? health.vaccinationRecords.map((r) => ({ ...r })) : [makeVaccinationRecord()],
    treatmentRecords: health?.treatmentRecords?.length ? health.treatmentRecords.map((r) => ({ ...r })) : [makeTreatmentRecord()],
  };
}

function withDefaults(animal) {
  const femaleDetails = {
    ...emptyFemaleDetails,
    ...(animal.femaleDetails || {}),
    pedigree: { ...emptyPedigree, ...(animal.femaleDetails?.pedigree || {}) },
    calvingParities: animal.femaleDetails?.calvingParities?.length ? animal.femaleDetails.calvingParities.map((p) => ({ ...p })) : [makeCalvingParity(1)],
    reproductionParities: animal.femaleDetails?.reproductionParities?.length
      ? animal.femaleDetails.reproductionParities.map((p) => ({
          ...p,
          aiRecords: (p.aiRecords || []).map((r) => ({ ...r, aiBullNo: r.aiBullNo ?? r.aiBull ?? "", aiSetNo: r.aiSetNo ?? "" })),
        }))
      : [makeReproParity(0)],
    productionLactations: animal.femaleDetails?.productionLactations?.length
      ? animal.femaleDetails.productionLactations.map((l) => ({
          ...l,
          fridayRecords: (l.fridayRecords || []).map((r) => recalcFridayRecord({ ...makeFridayRecord(r.date || ""), ...r, totalDailyYield: r.totalDailyYield ?? r.totalMilk ?? "" })),
        }))
      : [makeProductionLactation(1)],
    health: getHealthWithDefaults(animal.femaleDetails?.health),
    historyMeta: { ...emptyFemaleDetails.historyMeta, ...(animal.femaleDetails?.historyMeta || {}) },
  };

  const maleDetails = {
    ...emptyMaleDetails,
    ...(animal.maleDetails || {}),
    pedigree: { ...emptyPedigree, ...(animal.maleDetails?.pedigree || {}) },
    diseaseTests: animal.maleDetails?.diseaseTests?.length ? animal.maleDetails.diseaseTests.map((r) => ({ ...r })) : [makeDiseaseTestRecord()],
    health: getHealthWithDefaults(animal.maleDetails?.health),
    historyMeta: { ...emptyMaleDetails.historyMeta, ...(animal.maleDetails?.historyMeta || {}) },
  };

  const calvingCount = femaleDetails.calvingParities.length;
  const reproMap = new Map(femaleDetails.reproductionParities.map((p) => [String(p.parityNo), p]));
  if (!reproMap.has("0")) reproMap.set("0", makeReproParity(0));
  for (let i = 1; i <= calvingCount; i += 1) {
    if (!reproMap.has(String(i))) reproMap.set(String(i), makeReproParity(i));
  }
  const reproductionParities = [...reproMap.values()].sort((a, b) => Number(a.parityNo) - Number(b.parityNo));

  const lactationMap = new Map(femaleDetails.productionLactations.map((p) => [String(p.parityNo), p]));
  for (let i = 1; i <= calvingCount; i += 1) {
    if (!lactationMap.has(String(i))) lactationMap.set(String(i), makeProductionLactation(i));
  }
  const productionLactations = [...lactationMap.values()]
    .filter((p) => Number(p.parityNo) >= 1 && Number(p.parityNo) <= calvingCount)
    .sort((a, b) => Number(a.parityNo) - Number(b.parityNo))
    .map((l) => {
      const calvingDate = femaleDetails.calvingParities.find((c) => String(c.parityNo) === String(l.parityNo))?.calvingDate || "";
      return { ...l, calvingDate };
    });

  const selectedReproParity = reproductionParities.some((p) => String(p.parityNo) === String(femaleDetails.selectedReproParity)) ? String(femaleDetails.selectedReproParity) : "0";
  const selectedProductionParity = productionLactations.some((p) => String(p.parityNo) === String(femaleDetails.selectedProductionParity)) ? String(femaleDetails.selectedProductionParity) : productionLactations[0]?.parityNo || "1";

  return {
    ...animal,
    preCalvingLifecycle: animal.preCalvingLifecycle || "Heifer",
    exitDate: animal.exitDate || "",
    exitReason: animal.exitReason || "",
    isBreedingBull: animal.category === "Male" ? animal.isBreedingBull || "No" : "No",
    breedingSet: animal.category === "Male" && animal.isBreedingBull === "Yes" ? normalizeRomanInput(animal.breedingSet || "") : "",
    femaleDetails: {
      ...femaleDetails,
      reproductionParities,
      selectedReproParity,
      productionLactations,
      selectedProductionParity,
    },
    maleDetails,
  };
}

function getSireStringFromAnimal(animal) {
  if (!animal) return "";
  return animal.category === "Female" ? animal.femaleDetails?.pedigree?.sire || "" : animal.maleDetails?.pedigree?.sire || "";
}

function isProgenyOfBull(progeny, bull) {
  const sire = getSireStringFromAnimal(progeny).trim();
  const bullTag = (bull?.tagNo || "").trim();
  if (!sire || !bullTag) return false;
  return sire === bullTag || sire.startsWith(`${bullTag}/`) || sire.startsWith(`${bullTag} `);
}

function buildAutoCalfAnimal(dam, calvingParity) {
  if (dam?.category !== "Female") return null;
  if ((calvingParity?.calvingOutcome || "") !== "Normal calving") return null;
  const calfTag = (calvingParity?.calfTag || "").trim();
  const calfSex = calvingParity?.calfSex || "";
  const calfDob = calvingParity?.calvingDate || "";
  const calfSire = (calvingParity?.calfSire || getCalfSireForCalving(dam, calvingParity?.parityNo) || "").trim();
  if (!calfTag || !calfSex || !calfDob) return null;

  const base = {
    id: `calf-${dam.id}-${calvingParity.parityNo}`,
    tagNo: calfTag,
    breed: dam.breed || "Nili-Ravi buffalo",
    dob: calfDob,
    category: calfSex === "Female" ? "Female" : "Male",
    identificationMark: "",
    status: "Active (present in herd)",
    exitDate: "",
    exitReason: "",
    isBreedingBull: "No",
    breedingSet: "",
    linkedDamId: dam.id,
    linkedCalvingParityNo: String(calvingParity.parityNo),
    autoAddedFromBirth: true,
  };

  if (calfSex === "Female") {
    return withDefaults({
      ...base,
      femaleDetails: {
        ...emptyFemaleDetails,
        pedigree: { ...emptyPedigree, dam: dam.tagNo || "", sire: calfSire },
      },
    });
  }

  return withDefaults({
    ...base,
    maleDetails: {
      ...emptyMaleDetails,
      pedigree: { ...emptyPedigree, dam: dam.tagNo || "", sire: calfSire },
    },
  });
}

function syncDamCalvesInHerd(animals, dam) {
  if (!dam || dam.category !== "Female") return animals;
  const calfRecords = (dam.femaleDetails?.calvingParities || []).map((cp) => buildAutoCalfAnimal(dam, cp)).filter(Boolean);

  let nextAnimals = animals.filter((animal) => {
    if (!animal?.autoAddedFromBirth || animal?.linkedDamId !== dam.id) return true;
    return calfRecords.some((calf) => calf.id === animal.id);
  });

  calfRecords.forEach((calf) => {
    const existingIdx = nextAnimals.findIndex((animal) => animal.id === calf.id || (animal.tagNo === calf.tagNo && animal.id !== dam.id));
    if (existingIdx >= 0) {
      nextAnimals[existingIdx] = withDefaults({
        ...nextAnimals[existingIdx],
        ...calf,
        femaleDetails: calf.category === "Female" ? calf.femaleDetails : nextAnimals[existingIdx].femaleDetails,
        maleDetails: calf.category === "Male" ? calf.maleDetails : nextAnimals[existingIdx].maleDetails,
      });
    } else {
      nextAnimals = [calf, ...nextAnimals];
    }
  });

  return nextAnimals;
}

function nextDetailTab(tab, tabs) {
  const idx = tabs.indexOf(tab);
  return idx >= 0 && idx < tabs.length - 1 ? tabs[idx + 1] : tab;
}

function getSelectedReproParity(animal) {
  return animal?.femaleDetails?.reproductionParities?.find((p) => String(p.parityNo) === String(animal?.femaleDetails?.selectedReproParity)) || null;
}

function getSelectedLactation(animal) {
  return animal?.femaleDetails?.productionLactations?.find((p) => String(p.parityNo) === String(animal?.femaleDetails?.selectedProductionParity)) || null;
}

function getCalvingDateForParity(animal, parityNo) {
  const p = Number(parityNo);
  if (p <= 0) return "";
  return animal?.femaleDetails?.calvingParities?.find((c) => Number(c.parityNo) === p)?.calvingDate || "";
}

function getReproParityByNo(animal, parityNo) {
  return animal?.femaleDetails?.reproductionParities?.find((p) => Number(p.parityNo) === Number(parityNo)) || null;
}

function sortAIRecords(aiRecords = []) {
  return [...aiRecords].filter((r) => r.aiDate).sort((a, b) => {
    const ad = parseDisplayDate(a.aiDate);
    const bd = parseDisplayDate(b.aiDate);
    if (!ad || !bd) return 0;
    return ad.getTime() - bd.getTime();
  });
}

function getConceivedAIRecord(reproParity) {
  if (!reproParity) return null;
  const aiRecords = sortAIRecords(reproParity.aiRecords || []);
  if (!aiRecords.length) return null;
  const conceived = aiRecords.find((r) => r.result === "Conceived");
  if (conceived) return conceived;
  if (reproParity.conceptionDate) {
    const datedMatch = aiRecords.find((r) => r.aiDate === reproParity.conceptionDate);
    if (datedMatch) return datedMatch;
  }
  return aiRecords[aiRecords.length - 1] || null;
}

function formatBullSet(aiRecord) {
  if (!aiRecord) return "";
  const bullNo = (aiRecord.aiBullNo || "").trim();
  const setNo = (aiRecord.aiSetNo || "").trim();
  if (bullNo && setNo) return `${bullNo}/${setNo}`;
  return bullNo || setNo || "";
}

function getCalfSireForCalving(animal, calvingParityNo) {
  const sourceReproParity = Number(calvingParityNo) - 1;
  if (sourceReproParity < 0) return "";
  const reproParity = getReproParityByNo(animal, sourceReproParity);
  return formatBullSet(getConceivedAIRecord(reproParity));
}

function cleanPedValue(v) {
  return String(v || "").trim().toUpperCase();
}

function getFemalePedigreeMap(animal) {
  const p = animal?.femaleDetails?.pedigree || {};
  return {
    self: cleanPedValue(animal?.tagNo),
    sire: cleanPedValue(p.sire),
    dam: cleanPedValue(p.dam),
    sireSire: cleanPedValue(p.sireSire),
    sireDam: cleanPedValue(p.sireDam),
    damSire: cleanPedValue(p.damSire),
    damDam: cleanPedValue(p.damDam),
  };
}

function getMalePedigreeMap(animal) {
  const p = animal?.maleDetails?.pedigree || {};
  return {
    self: cleanPedValue(animal?.tagNo),
    sire: cleanPedValue(p.sire),
    dam: cleanPedValue(p.dam),
    sireSire: cleanPedValue(p.sireSire),
    sireDam: cleanPedValue(p.sireDam),
    damSire: cleanPedValue(p.damSire),
    damDam: cleanPedValue(p.damDam),
  };
}

function estimateRelationshipScore(female, bull) {
  const f = getFemalePedigreeMap(female);
  const b = getMalePedigreeMap(bull);

  let score = 0;
  const reasons = [];

  if (!bull?.tagNo || bull?.category !== "Male" || bull?.isBreedingBull !== "Yes") {
    return { score: 999, inbreedingPct: "High", status: "Avoid", reasons: ["Not marked as breeding bull"] };
  }

  if (b.self && (b.self === f.sire || b.self === f.dam)) {
    return { score: 999, inbreedingPct: "25.0", status: "Avoid", reasons: ["Direct parent match"] };
  }

  if (f.sire && b.sire && f.sire === b.sire) {
    score += 12.5;
    reasons.push("Same sire");
  }

  if (f.dam && b.dam && f.dam === b.dam) {
    score += 12.5;
    reasons.push("Same dam");
  }

  const femaleGrandparents = [f.sireSire, f.sireDam, f.damSire, f.damDam].filter(Boolean);
  const bullGrandparents = [b.sireSire, b.sireDam, b.damSire, b.damDam].filter(Boolean);

  femaleGrandparents.forEach((gp) => {
    if (bullGrandparents.includes(gp)) {
      score += 3.125;
      reasons.push(`Shared grandparent ${gp}`);
    }
  });

  if (b.self && femaleGrandparents.includes(b.self)) {
    score += 12.5;
    reasons.push("Bull matches female grandparent");
  }

  if (f.self && bullGrandparents.includes(f.self)) {
    score += 12.5;
    reasons.push("Female matches bull grandparent");
  }

  let status = "Preferred";
  if (score >= 12.5) status = "Avoid";
  else if (score >= 3.125) status = "Use with caution";

  return {
    score,
    inbreedingPct: score.toFixed(3),
    status,
    reasons: reasons.length ? reasons : ["No close pedigree conflict detected"],
  };
}

function getPreviouslyUsedBullKeys(female) {
  if (!female || female.category !== "Female") return new Set();
  const keys = new Set();
  (female.femaleDetails?.reproductionParities || []).forEach((parity) => {
    (parity.aiRecords || []).forEach((r) => {
      const bullNo = cleanPedValue(r.aiBullNo || "");
      const setNo = cleanPedValue(r.aiSetNo || "");
      if (bullNo || setNo) keys.add(`${bullNo}__${setNo}`);
    });
  });
  return keys;
}

function makeBullKey(bull) {
  return `${cleanPedValue(bull?.tagNo)}__${cleanPedValue(bull?.breedingSet)}`;
}

function classifyMateSelectionAdvanced(female, bull) {
  const relationship = estimateRelationshipScore(female, bull);
  const usedKeys = getPreviouslyUsedBullKeys(female);
  const currentBullKey = makeBullKey(bull);
  const reasons = [...relationship.reasons];
  let status = relationship.status;
  let sortScore = relationship.score;

  if (usedKeys.has(currentBullKey)) {
    reasons.push("Already used in previous parity/AI records");
    sortScore += 100;
    if (status === "Preferred") status = "Use with caution";
    if (relationship.score >= 12.5) status = "Avoid";
  }

  return {
    bull,
    status,
    sortScore,
    inbreedingPct: relationship.inbreedingPct,
    reason: reasons.join("; "),
    alreadyUsed: usedKeys.has(currentBullKey),
  };
}

function getMateSelectionRowsAdvanced(female, animals) {
  if (!female || female.category !== "Female") return [];
  return animals
    .filter((a) => a.category === "Male" && a.isBreedingBull === "Yes" && !isArchivedAnimal(a))
    .map((bull) => classifyMateSelectionAdvanced(female, bull))
    .sort((a, b) => {
      if (a.sortScore !== b.sortScore) return a.sortScore - b.sortScore;
      return String(a.bull.tagNo).localeCompare(String(b.bull.tagNo), undefined, { numeric: true, sensitivity: "base" });
    });
}

function computeCalvingMetrics(animal, calvingParityNo) {
  const p = Number(calvingParityNo);
  const currentCalving = getCalvingDateForParity(animal, p);
  const previousCalving = getCalvingDateForParity(animal, p - 1);
  const previousRepro = getReproParityByNo(animal, p - 1);
  let afc = null;
  if (p === 1 && animal?.dob && currentCalving) afc = daysBetween(animal.dob, currentCalving);
  let gestationPeriod = null;
  if (previousRepro?.conceptionDate && currentCalving) gestationPeriod = daysBetween(previousRepro.conceptionDate, currentCalving);
  let servicePeriod = null;
  if (p >= 2 && previousCalving && previousRepro?.conceptionDate) servicePeriod = daysBetween(previousCalving, previousRepro.conceptionDate);
  let calvingInterval = null;
  if (p >= 2 && previousCalving && currentCalving) calvingInterval = daysBetween(previousCalving, currentCalving);
  return { afc, gestationPeriod, servicePeriod, calvingInterval };
}

function computeReproSummary(animal, parity) {
  if (!animal || !parity) return { parityLabel: "Heifer stage", lastAIDate: "", services: 0 };
  const parityNo = Number(parity.parityNo);
  const aiRecords = sortAIRecords(parity.aiRecords || []);
  const lastAIDate = aiRecords.length ? aiRecords[aiRecords.length - 1].aiDate : "";
  return { parityLabel: parityNo === 0 ? "Heifer stage" : `Parity ${parityNo}`, lastAIDate, services: aiRecords.length };
}

function computeProductionMetrics(lactation) {
  if (!lactation) return { lactationLength: 0, totalLactationMilk: 0, standardLactationMilk: 0, peakYield: 0 };
  const calvingDate = lactation.calvingDate || "";
  const dryDate = lactation.dryDate || "";
  const lactationLength = calvingDate && dryDate ? daysBetween(calvingDate, dryDate) + 1 : 0;

  if (lactation.entryMode === "Manual") {
    return {
      lactationLength,
      totalLactationMilk: Number(lactation.manualSummary.totalLactationMilk || 0),
      standardLactationMilk: Number(lactation.manualSummary.standardLactationMilk || 0),
      peakYield: Number(lactation.manualSummary.peakYield || 0),
    };
  }

  const records = [...(lactation.fridayRecords || [])].filter((r) => r.date).sort((a, b) => {
    const ad = parseDisplayDate(a.date);
    const bd = parseDisplayDate(b.date);
    if (!ad || !bd) return 0;
    return ad.getTime() - bd.getTime();
  });

  const firstFriday = firstRecordableFriday(calvingDate);
  let total = 0;
  let standard = 0;
  let peak = 0;
  let usedDays = 0;
  let standardUsed = 0;
  const hardLength = lactationLength > 0 ? lactationLength : Infinity;

  records.forEach((r, index) => {
    const milk = Number(r.totalDailyYield || 0);
    peak = Math.max(peak, milk);
    const fullBlock = index === 0 && firstFriday && r.date === firstFriday ? daysBetween(calvingDate, firstFriday) + 7 : 7;
    const applied = Math.max(0, Math.min(fullBlock, hardLength - usedDays));
    usedDays += applied;
    total += milk * applied;
    const standardApplied = Math.max(0, Math.min(applied, 305 - standardUsed));
    standardUsed += standardApplied;
    standard += milk * standardApplied;
  });

  return { lactationLength, totalLactationMilk: total, standardLactationMilk: standard, peakYield: peak };
}

function computeHistoryRows(animal) {
  const rows = [];
  for (let p = 0; p <= 10; p += 1) {
    const repro = getReproParityByNo(animal, p);
    const calving = animal?.femaleDetails?.calvingParities?.find((c) => Number(c.parityNo) === p) || null;
    const lactation = animal?.femaleDetails?.productionLactations?.find((l) => Number(l.parityNo) === p) || null;
    const prod = lactation ? computeProductionMetrics(lactation) : null;
    const aiRecords = sortAIRecords(repro?.aiRecords || []);
    const firstAI = aiRecords[0]?.aiDate || "";
    const conceivedAI = getConceivedAIRecord(repro);
    const bullNo = formatBullSet(conceivedAI || aiRecords[aiRecords.length - 1]);
    const totalAI = aiRecords.length ? String(aiRecords.length) : "";
    const calfTag = calving?.calfTag || "";
    const currentCalvingDate = getCalvingDateForParity(animal, p);
    const nextCalvingDate = getCalvingDateForParity(animal, p + 1);
    const rowServicePeriod = p >= 1 && currentCalvingDate && repro?.conceptionDate ? String(daysBetween(currentCalvingDate, repro.conceptionDate)) : "";
    const rowCalvingInterval = p >= 1 && currentCalvingDate && nextCalvingDate ? String(daysBetween(currentCalvingDate, nextCalvingDate)) : "";
    const metrics = p >= 1 ? computeCalvingMetrics(animal, p) : { afc: null, gestationPeriod: null };

    rows.push({
      parity: String(p),
      dateCalved: calving?.calvingDate || "",
      gp: metrics.gestationPeriod === null ? "" : String(metrics.gestationPeriod),
      sexOfCalf: calving?.calvingOutcome === "Normal calving" ? calving?.calfSex || "" : calving?.calvingOutcome || "",
      calfTag,
      firstAI,
      conceptionDate: repro?.conceptionDate || "",
      bullNo,
      totalAI,
      dryDate: lactation?.dryDate || "",
      tlmy: lactation ? (lactation.entryMode === "Manual" ? lactation.manualSummary.totalLactationMilk || "" : prod ? String(prod.totalLactationMilk.toFixed(1)) : "") : "",
      slmy: lactation ? (lactation.entryMode === "Manual" ? lactation.manualSummary.standardLactationMilk || "" : prod ? String(prod.standardLactationMilk.toFixed(1)) : "") : "",
      ll: lactation && lactation.dryDate && prod ? String(prod.lactationLength) : "",
      py: lactation ? (lactation.entryMode === "Manual" ? lactation.manualSummary.peakYield || "" : prod ? String(prod.peakYield.toFixed(1)) : "") : "",
      sp: rowServicePeriod,
      ci: rowCalvingInterval,
      fat: "",
      snf: "",
      ts: "",
    });
  }
  return rows;
}

function exportHistoryPdf(animal) {
  if (!animal) return;
  const full = withDefaults(animal);
  const rows = computeHistoryRows(full);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text("BUFFALO HISTORY SHEET", 148, 12, { align: "center" });
  doc.setFontSize(10);
  doc.text("ICAR-CENTRAL INSTITUTE FOR RESEARCH ON BUFFALOES", 148, 18, { align: "center" });
  doc.text("SUB-CAMPUS, NABHA PUNJAB 147201", 148, 23, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Animal No.: ${full.tagNo || ""}`, 14, 32);
  doc.text(`Date of Birth: ${full.dob || ""}`, 70, 32);
  doc.text(`AFC (days): ${computeCalvingMetrics(full, 1).afc ?? ""}`, 120, 32);
  doc.text(`Reason for culling: ${full.femaleDetails.historyMeta.reasonForCulling || ""}`, 165, 32);
  doc.text(`Book Value: ${full.femaleDetails.historyMeta.bookValue || ""}`, 235, 32);

  autoTable(doc, {
    startY: 36,
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: [220, 245, 232], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    head: [["Parity", "Date Calved", "GP", "Sex of Calf", "Tag No. of Calf", "Date of 1st A.I", "Date of Conception", "Bull No./Set No.", "Total no. of AI", "Dry Date", "TLMY", "SLMY", "LL", "PY", "SP", "CI", "Fat %", "SNF %", "TS %"]],
    body: rows.map((r) => [r.parity, r.dateCalved, r.gp, r.sexOfCalf, r.calfTag, r.firstAI, r.conceptionDate, r.bullNo, r.totalAI, r.dryDate, r.tlmy, r.slmy, r.ll, r.py, r.sp, r.ci, r.fat, r.snf, r.ts]),
    margin: { left: 8, right: 8 },
  });

  doc.save(`buffalo-history-sheet-${full.tagNo || "animal"}.pdf`);
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-md backdrop-blur">
      <div className="mb-3 text-lg font-semibold text-emerald-900">{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{children}</div>;
}

function TextField({ label, value, onChange, type = "text", readOnly = false, placeholder = "" }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input className="rounded-xl border border-emerald-200 px-3 py-2 focus:border-emerald-500 focus:outline-none" type={type} value={value} readOnly={readOnly} placeholder={placeholder} onChange={readOnly ? undefined : (e) => onChange(e.target.value)} />
    </label>
  );
}

function DateField({ label, value, onChange, readOnly = false }) {
  return <TextField label={label} value={value} onChange={(v) => onChange(normalizeDisplayDate(v))} readOnly={readOnly} placeholder="dd/mm/yyyy" />;
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <select className="rounded-xl border border-emerald-200 px-3 py-2 focus:border-emerald-500 focus:outline-none" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((o) => (
          <option key={o} value={o}>{o || "—"}</option>
        ))}
      </select>
    </label>
  );
}

function AreaField({ label, value, onChange, rows = 4, readOnly = false }) {
  return (
    <label className="flex flex-col gap-1 text-sm md:col-span-3">
      <span>{label}</span>
      <textarea className="rounded-xl border border-emerald-200 px-3 py-2 focus:border-emerald-500 focus:outline-none" rows={rows} value={value} readOnly={readOnly} onChange={readOnly ? undefined : (e) => onChange(e.target.value)} />
    </label>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-cyan-50 p-4 shadow-md">
      <div className="text-sm text-emerald-700">{title}</div>
      <div className="text-2xl font-semibold text-emerald-900">{value}</div>
    </div>
  );
}

export default function AnimalDataRecordingApp() {
  const [animals, setAnimals] = useState(initialAnimals);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editAnimalId, setEditAnimalId] = useState(null);
  const [detailTab, setDetailTab] = useState("pedigree");
  const [healthSubTab, setHealthSubTab] = useState("bodyWeight");
  const [maleProgenySubTab, setMaleProgenySubTab] = useState("female");
  const [daughterPerfSubTab, setDaughterPerfSubTab] = useState("production");
  const [herdView, setHerdView] = useState("current");
  const [newAnimal, setNewAnimal] = useState({ ...emptyAnimal });

  const normalizedAnimals = useMemo(() => animals.map((a) => withDefaults(a)), [animals]);
  const activeAnimals = useMemo(() => normalizedAnimals.filter((a) => !isArchivedAnimal(a)), [normalizedAnimals]);
  const archivedAnimals = useMemo(() => normalizedAnimals.filter((a) => isArchivedAnimal(a)), [normalizedAnimals]);

  const filteredCurrentAnimals = useMemo(() => {
    const q = search.toLowerCase();
    return activeAnimals.filter((a) => [a.tagNo, a.breed, a.category, a.status, a.isBreedingBull, a.breedingSet, getFemaleLifecycle(a)].join(" ").toLowerCase().includes(q));
  }, [activeAnimals, search]);

  const filteredArchivedAnimals = useMemo(() => {
    const q = search.toLowerCase();
    return archivedAnimals.filter((a) => [a.tagNo, a.breed, a.category, a.status, a.exitDate, a.exitReason].join(" ").toLowerCase().includes(q));
  }, [archivedAnimals, search]);

  const femaleAnimals = useMemo(() => filteredCurrentAnimals.filter((a) => a.category === "Female").slice().sort(sortByTag), [filteredCurrentAnimals]);
  const maleAnimals = useMemo(() => filteredCurrentAnimals.filter((a) => a.category === "Male").slice().sort(sortByTag), [filteredCurrentAnimals]);
  const archivedFemaleAnimals = useMemo(() => filteredArchivedAnimals.filter((a) => a.category === "Female").slice().sort(sortByTag), [filteredArchivedAnimals]);
  const archivedMaleAnimals = useMemo(() => filteredArchivedAnimals.filter((a) => a.category === "Male").slice().sort(sortByTag), [filteredArchivedAnimals]);

  const stats = useMemo(() => {
    const females = activeAnimals.filter((a) => a.category === "Female");
    const males = activeAnimals.filter((a) => a.category === "Male");
    return {
      totalAnimals: activeAnimals.length,
      femaleCount: females.length,
      maleCount: males.length,
      heiferCount: females.filter((a) => getFemaleLifecycle(a) === "Heifer").length,
      colostrumHeiferCount: females.filter((a) => getFemaleLifecycle(a) === "Colostrum-Heifer").length,
      colostrumCount: females.filter((a) => getFemaleLifecycle(a) === "Colostrum").length,
      milkCount: females.filter((a) => getFemaleLifecycle(a) === "Milk").length,
      dryCount: females.filter((a) => getFemaleLifecycle(a) === "Dry").length,
    };
  }, [activeAnimals]);

  const selectedAnimal = normalizedAnimals.find((a) => a.id === selectedId) || null;
  const selectedReproParity = selectedAnimal ? getSelectedReproParity(selectedAnimal) : null;
  const selectedLactation = selectedAnimal ? getSelectedLactation(selectedAnimal) : null;
  const reproSummary = selectedAnimal && selectedReproParity ? computeReproSummary(selectedAnimal, selectedReproParity) : null;
  const productionMetrics = selectedLactation ? computeProductionMetrics(selectedLactation) : { lactationLength: 0, totalLactationMilk: 0, standardLactationMilk: 0, peakYield: 0 };
  const historyRows = selectedAnimal?.category === "Female" ? computeHistoryRows(selectedAnimal) : [];
  const afcValue = selectedAnimal?.category === "Female" ? computeCalvingMetrics(selectedAnimal, 1).afc ?? "" : "";
  const visibleTabs = selectedAnimal?.category === "Female" ? FEMALE_TABS : selectedAnimal?.category === "Male" && selectedAnimal?.isBreedingBull === "Yes" ? MALE_TABS : [];
  const mateSelectionRows = useMemo(() => {
    if (!selectedAnimal || selectedAnimal.category !== "Female") return [];
    return getMateSelectionRowsAdvanced(selectedAnimal, normalizedAnimals);
  }, [selectedAnimal, normalizedAnimals]);

  const femaleProgenies = useMemo(() => {
    if (!selectedAnimal || selectedAnimal.category !== "Male" || selectedAnimal.isBreedingBull !== "Yes") return [];
    return normalizedAnimals.filter((a) => a.category === "Female" && a.id !== selectedAnimal.id && isProgenyOfBull(a, selectedAnimal)).sort(sortByTag);
  }, [normalizedAnimals, selectedAnimal]);

  const maleProgenies = useMemo(() => {
    if (!selectedAnimal || selectedAnimal.category !== "Male" || selectedAnimal.isBreedingBull !== "Yes") return [];
    return normalizedAnimals.filter((a) => a.category === "Male" && a.id !== selectedAnimal.id && isProgenyOfBull(a, selectedAnimal)).sort(sortByTag);
  }, [normalizedAnimals, selectedAnimal]);

  function handleFormStatusChange(status) {
    setNewAnimal((s) => normalizeAnimalFormData({ ...s, status }));
  }

  function handleFormCategoryChange(category) {
    setNewAnimal((s) => normalizeAnimalFormData({ ...s, category }));
  }

  function addAnimal() {
    if (!newAnimal.tagNo.trim()) return;
    const prepared = normalizeAnimalFormData(newAnimal);
    if (editAnimalId) {
      setAnimals((prev) => {
        let updatedAnimal = null;
        const mapped = prev.map((a) => {
          if (a.id !== editAnimalId) return a;
          updatedAnimal = withDefaults({ ...a, ...prepared, id: a.id });
          return updatedAnimal;
        });
        return updatedAnimal?.category === "Female" ? syncDamCalvesInHerd(mapped, updatedAnimal) : mapped;
      });
      setSelectedId(editAnimalId);
      setEditAnimalId(null);
    } else {
      const item = withDefaults({ id: Date.now(), ...prepared });
      setAnimals((prev) => [item, ...prev]);
      setSelectedId(item.id);
    }
    setNewAnimal({ ...emptyAnimal });
    setShowAdd(false);
  }

  function startEditAnimal() {
    if (!selectedAnimal) return;
    setEditAnimalId(selectedAnimal.id);
    setNewAnimal({
      tagNo: selectedAnimal.tagNo || "",
      breed: selectedAnimal.breed || "Nili-Ravi buffalo",
      dob: selectedAnimal.dob || "",
      category: selectedAnimal.category || "Female",
      identificationMark: selectedAnimal.identificationMark || "",
      status: selectedAnimal.status || "Active (present in herd)",
      exitDate: selectedAnimal.exitDate || "",
      exitReason: selectedAnimal.exitReason || "",
      isBreedingBull: selectedAnimal.isBreedingBull || "No",
      breedingSet: selectedAnimal.breedingSet || "",
    });
    setShowAdd(true);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditAnimalId(null);
    setNewAnimal({ ...emptyAnimal });
  }

  function patchSelected(fn) {
    setAnimals((prev) => {
      let updatedSelected = null;
      const mapped = prev.map((a) => {
        if (a.id !== selectedId) return a;
        updatedSelected = fn(withDefaults(a));
        return updatedSelected;
      });
      return updatedSelected?.category === "Female" ? syncDamCalvesInHerd(mapped, updatedSelected) : mapped;
    });
  }

  function updateFemalePedigree(key, value) {
    patchSelected((a) => ({ ...a, femaleDetails: { ...a.femaleDetails, pedigree: { ...a.femaleDetails.pedigree, [key]: value } } }));
  }

  function updateMalePedigree(key, value) {
    patchSelected((a) => ({ ...a, maleDetails: { ...a.maleDetails, pedigree: { ...a.maleDetails.pedigree, [key]: value } } }));
  }

  function updateCalvingParity(rowIdx, key, value) {
    patchSelected((a) => {
      const parities = [...a.femaleDetails.calvingParities];
      const updated = { ...parities[rowIdx], [key]: value };
      if (key === "calvingDate" && value) {
        updated.calfSire = getCalfSireForCalving(a, parities[rowIdx].parityNo);
        a = { ...a, preCalvingLifecycle: getFemaleLifecycle(a) };
      }
      if (key === "calvingOutcome" && value !== "Normal calving") {
        updated.calfSex = "";
        updated.calfTag = "";
        updated.calfSire = "";
      }
      parities[rowIdx] = updated;
      return withDefaults({ ...a, femaleDetails: { ...a.femaleDetails, calvingParities: parities } });
    });
  }

  function incrementCalvingParity() {
    patchSelected((a) => withDefaults({ ...a, femaleDetails: { ...a.femaleDetails, calvingParities: [...a.femaleDetails.calvingParities, makeCalvingParity(a.femaleDetails.calvingParities.length + 1)] } }));
  }

  function decrementCalvingParity() {
    patchSelected((a) => {
      if (a.femaleDetails.calvingParities.length <= 1) return a;
      return withDefaults({ ...a, femaleDetails: { ...a.femaleDetails, calvingParities: a.femaleDetails.calvingParities.slice(0, -1) } });
    });
  }

  function incrementReproParity() {
    patchSelected((a) => {
      const current = Number(a.femaleDetails.selectedReproParity || 0);
      const nextNo = String(current + 1);
      const exists = a.femaleDetails.reproductionParities.some((p) => String(p.parityNo) === nextNo);
      return withDefaults({ ...a, femaleDetails: { ...a.femaleDetails, selectedReproParity: nextNo, reproductionParities: exists ? a.femaleDetails.reproductionParities : [...a.femaleDetails.reproductionParities, makeReproParity(nextNo)] } });
    });
  }

  function decrementReproParity() {
    patchSelected((a) => ({ ...a, femaleDetails: { ...a.femaleDetails, selectedReproParity: String(Math.max(0, Number(a.femaleDetails.selectedReproParity || 0) - 1)) } }));
  }

  function updateSelectedRepro(key, value) {
    patchSelected((a) => {
      const parities = [...a.femaleDetails.reproductionParities];
      const idx = parities.findIndex((p) => String(p.parityNo) === String(a.femaleDetails.selectedReproParity));
      if (idx < 0) return a;
      const updated = { ...parities[idx], [key]: value };
      if (key === "conceptionDate") updated.expectedCalvingDate = expectedCalving(value);
      parities[idx] = updated;
      return { ...a, femaleDetails: { ...a.femaleDetails, reproductionParities: parities } };
    });
  }

  function addAIRecord() {
    patchSelected((a) => {
      const parities = [...a.femaleDetails.reproductionParities];
      const idx = parities.findIndex((p) => String(p.parityNo) === String(a.femaleDetails.selectedReproParity));
      if (idx < 0) return a;
      parities[idx] = { ...parities[idx], aiRecords: [...parities[idx].aiRecords, { aiDate: "", aiBullNo: "", aiSetNo: "", result: "Pending" }] };
      return { ...a, femaleDetails: { ...a.femaleDetails, reproductionParities: parities } };
    });
  }

  function removeAIRecord() {
    patchSelected((a) => {
      const parities = [...a.femaleDetails.reproductionParities];
      const idx = parities.findIndex((p) => String(p.parityNo) === String(a.femaleDetails.selectedReproParity));
      if (idx < 0 || parities[idx].aiRecords.length === 0) return a;
      parities[idx] = { ...parities[idx], aiRecords: parities[idx].aiRecords.slice(0, -1) };
      return { ...a, femaleDetails: { ...a.femaleDetails, reproductionParities: parities } };
    });
  }

  function updateAIRecord(rowIdx, key, value) {
    patchSelected((a) => {
      const parities = [...a.femaleDetails.reproductionParities];
      const idx = parities.findIndex((p) => String(p.parityNo) === String(a.femaleDetails.selectedReproParity));
      if (idx < 0) return a;
      const aiRecords = [...parities[idx].aiRecords];
      const rec = { ...(aiRecords[rowIdx] || { aiDate: "", aiBullNo: "", aiSetNo: "", result: "Pending" }), [key]: value };
      aiRecords[rowIdx] = rec;
      const updated = { ...parities[idx], aiRecords };
      if (key === "result" && value === "Conceived") {
        updated.conceptionDate = rec.aiDate || updated.conceptionDate;
        updated.expectedCalvingDate = expectedCalving(updated.conceptionDate);
      }
      parities[idx] = updated;
      return { ...a, femaleDetails: { ...a.femaleDetails, reproductionParities: parities } };
    });
  }

  function applyBullToSelectedParity(bull) {
    patchSelected((a) => {
      const parities = [...a.femaleDetails.reproductionParities];
      const idx = parities.findIndex((p) => String(p.parityNo) === String(a.femaleDetails.selectedReproParity));
      if (idx < 0) return a;

      const aiRecords = [...(parities[idx].aiRecords || [])];
      const baseRecord = aiRecords.length > 0
        ? aiRecords[aiRecords.length - 1]
        : { aiDate: "", aiBullNo: "", aiSetNo: "", result: "Pending" };

      const updatedRecord = {
        ...baseRecord,
        aiBullNo: bull.tagNo || "",
        aiSetNo: bull.breedingSet || "",
      };

      if (aiRecords.length === 0) aiRecords.push(updatedRecord);
      else aiRecords[aiRecords.length - 1] = updatedRecord;

      parities[idx] = { ...parities[idx], aiRecords };
      return { ...a, femaleDetails: { ...a.femaleDetails, reproductionParities: parities } };
    });
  }

  function selectProductionParity(value) {
    patchSelected((a) => ({ ...a, femaleDetails: { ...a.femaleDetails, selectedProductionParity: String(value) } }));
  }

  function addFridayRecord() {
    patchSelected((a) => {
      const lactations = [...a.femaleDetails.productionLactations];
      const idx = lactations.findIndex((l) => String(l.parityNo) === String(a.femaleDetails.selectedProductionParity));
      if (idx < 0) return a;
      const nextDate = getNextFridayRecordDate(lactations[idx]);
      lactations[idx] = { ...lactations[idx], fridayRecords: [...(lactations[idx].fridayRecords || []), makeFridayRecord(nextDate)] };
      return { ...a, femaleDetails: { ...a.femaleDetails, productionLactations: lactations } };
    });
  }

  function removeFridayRecord() {
    patchSelected((a) => {
      const lactations = [...a.femaleDetails.productionLactations];
      const idx = lactations.findIndex((l) => String(l.parityNo) === String(a.femaleDetails.selectedProductionParity));
      if (idx < 0) return a;
      lactations[idx] = { ...lactations[idx], fridayRecords: (lactations[idx].fridayRecords || []).slice(0, -1) };
      return { ...a, femaleDetails: { ...a.femaleDetails, productionLactations: lactations } };
    });
  }

  function updateSelectedLactation(key, value) {
    patchSelected((a) => {
      const lactations = [...a.femaleDetails.productionLactations];
      const idx = lactations.findIndex((l) => String(l.parityNo) === String(a.femaleDetails.selectedProductionParity));
      if (idx < 0) return a;
      const updated = { ...lactations[idx], [key]: value };
      if (key === "entryMode" && value === "Friday Records" && !(updated.fridayRecords || []).length) updated.fridayRecords = [];
      lactations[idx] = updated;
      return { ...a, femaleDetails: { ...a.femaleDetails, productionLactations: lactations } };
    });
  }

  function updateManualSummary(key, value) {
    patchSelected((a) => {
      const lactations = [...a.femaleDetails.productionLactations];
      const idx = lactations.findIndex((l) => String(l.parityNo) === String(a.femaleDetails.selectedProductionParity));
      if (idx < 0) return a;
      lactations[idx] = { ...lactations[idx], manualSummary: { ...lactations[idx].manualSummary, [key]: value } };
      return { ...a, femaleDetails: { ...a.femaleDetails, productionLactations: lactations } };
    });
  }

  function updateFridayRecord(rowIdx, key, value) {
    patchSelected((a) => {
      const lactations = [...a.femaleDetails.productionLactations];
      const idx = lactations.findIndex((l) => String(l.parityNo) === String(a.femaleDetails.selectedProductionParity));
      if (idx < 0) return a;
      const records = [...(lactations[idx].fridayRecords || [])];
      const existing = records[rowIdx] || makeFridayRecord("");
      records[rowIdx] = recalcFridayRecord({ ...existing, [key]: value });
      lactations[idx] = { ...lactations[idx], fridayRecords: records };
      return { ...a, femaleDetails: { ...a.femaleDetails, productionLactations: lactations } };
    });
  }

  function addHealthRecord(target, section, blankRecord) {
    patchSelected((a) => ({
      ...a,
      [target]: {
        ...a[target],
        health: {
          ...a[target].health,
          [section]: [...(a[target].health[section] || []), blankRecord],
        },
      },
    }));
  }

  function removeHealthRecord(target, section) {
    patchSelected((a) => {
      const current = a[target].health[section] || [];
      if (current.length <= 1) return a;
      return {
        ...a,
        [target]: {
          ...a[target],
          health: {
            ...a[target].health,
            [section]: current.slice(0, -1),
          },
        },
      };
    });
  }

  function updateHealthRecord(target, section, rowIdx, key, value) {
    patchSelected((a) => {
      const current = [...(a[target].health[section] || [])];
      current[rowIdx] = { ...(current[rowIdx] || {}), [key]: value };
      return {
        ...a,
        [target]: {
          ...a[target],
          health: {
            ...a[target].health,
            [section]: current,
          },
        },
      };
    });
  }

  function addDiseaseTest() {
    patchSelected((a) => ({ ...a, maleDetails: { ...a.maleDetails, diseaseTests: [...(a.maleDetails.diseaseTests || []), makeDiseaseTestRecord()] } }));
  }

  function removeDiseaseTest() {
    patchSelected((a) => {
      if ((a.maleDetails.diseaseTests || []).length <= 1) return a;
      return { ...a, maleDetails: { ...a.maleDetails, diseaseTests: a.maleDetails.diseaseTests.slice(0, -1) } };
    });
  }

  function updateDiseaseTest(rowIdx, key, value) {
    patchSelected((a) => {
      const current = [...(a.maleDetails.diseaseTests || [])];
      current[rowIdx] = { ...(current[rowIdx] || {}), [key]: value };
      return { ...a, maleDetails: { ...a.maleDetails, diseaseTests: current } };
    });
  }

  function updateFemaleHistoryMeta(key, value) {
    patchSelected((a) => ({ ...a, femaleDetails: { ...a.femaleDetails, historyMeta: { ...a.femaleDetails.historyMeta, [key]: value } } }));
  }

  function updateMaleHistoryMeta(key, value) {
    patchSelected((a) => ({ ...a, maleDetails: { ...a.maleDetails, historyMeta: { ...a.maleDetails.historyMeta, [key]: value } } }));
  }

  const femaleTarget = "femaleDetails";
  const maleTarget = "maleDetails";
  const selectedHealthTarget = selectedAnimal?.category === "Female" ? femaleTarget : maleTarget;
  const selectedHealth = selectedAnimal?.category === "Female" ? selectedAnimal?.femaleDetails?.health : selectedAnimal?.maleDetails?.health;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-sky-100 p-4 text-slate-800 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-3xl bg-white/90 p-5 shadow-xl ring-1 ring-emerald-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-3xl font-bold tracking-tight text-emerald-900">Buffalo Animal Data Recording App</div>
              <div className="mt-1 text-sm text-slate-600">Murrah Farm and Nili-Ravi Farm · starts blank · breeding bulls get dedicated performance tabs</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white shadow hover:bg-emerald-700" onClick={() => { setShowAdd(true); setEditAnimalId(null); setNewAnimal({ ...emptyAnimal }); }}>
                Add Animal
              </button>
              {selectedAnimal?.category === "Female" && (
                <button className="rounded-xl border border-emerald-300 bg-white px-4 py-2 font-medium text-emerald-800 hover:bg-emerald-50" onClick={() => exportHistoryPdf(selectedAnimal)}>
                  Export History PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {showAdd && (
          <Section title={editAnimalId ? "Edit Animal" : "Add Animal"}>
            <Grid>
              <SelectField label="Breed" value={newAnimal.breed} onChange={(v) => setNewAnimal((s) => ({ ...s, breed: v }))} options={BREEDS} />
              <TextField label="Tag No." value={newAnimal.tagNo} onChange={(v) => setNewAnimal((s) => ({ ...s, tagNo: v }))} />
              <DateField label="Date of birth" value={newAnimal.dob} onChange={(v) => setNewAnimal((s) => ({ ...s, dob: v }))} />
              <SelectField label="Category" value={newAnimal.category} onChange={handleFormCategoryChange} options={SEX_OPTIONS} />
              <TextField label="Identification mark" value={newAnimal.identificationMark} onChange={(v) => setNewAnimal((s) => ({ ...s, identificationMark: v }))} />
              <SelectField label="Status" value={newAnimal.status} onChange={handleFormStatusChange} options={STATUS_OPTIONS} />
              {newAnimal.category === "Male" && (
                <>
                  <SelectField label="Selected for breeding" value={newAnimal.isBreedingBull || "No"} onChange={(v) => setNewAnimal((s) => normalizeAnimalFormData({ ...s, isBreedingBull: v }))} options={["No", "Yes"]} />
                  {newAnimal.isBreedingBull === "Yes" && <TextField label="Included as breeding in which set (Roman numerals only)" value={newAnimal.breedingSet || ""} onChange={(v) => setNewAnimal((s) => ({ ...s, breedingSet: normalizeRomanInput(v) }))} />}
                </>
              )}
              {newAnimal.status !== "Active (present in herd)" && (
                <>
                  <DateField label="Date of Death / Culling" value={newAnimal.exitDate || ""} onChange={(v) => setNewAnimal((s) => ({ ...s, exitDate: v }))} />
                  <AreaField label="Reason of Death / Culling" value={newAnimal.exitReason || ""} onChange={(v) => setNewAnimal((s) => ({ ...s, exitReason: v }))} rows={3} />
                </>
              )}
            </Grid>
            <div className="mt-4 flex gap-2">
              <button className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700" onClick={addAnimal}>{editAnimalId ? "Save Changes" : "Save Animal"}</button>
              <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50" onClick={cancelForm}>Cancel</button>
            </div>
          </Section>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Animals" value={stats.totalAnimals} />
          <StatCard title="Females" value={stats.femaleCount} />
          <StatCard title="Males" value={stats.maleCount} />
          <StatCard title="Heifers" value={stats.heiferCount} />
          <StatCard title="Colostrum-Heifer" value={stats.colostrumHeiferCount} />
          <StatCard title="Colostrum" value={stats.colostrumCount} />
          <StatCard title="In Milk" value={stats.milkCount} />
          <StatCard title="Dry" value={stats.dryCount} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[420px_1fr]">
          <Section title="Herd Registry">
            <TextField label="Search" value={search} onChange={setSearch} />
            <div className="mt-3 flex gap-2">
              <button className={`rounded-xl border px-3 py-2 ${herdView === "current" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setHerdView("current")}>Current Herd</button>
              <button className={`rounded-xl border px-3 py-2 ${herdView === "archive" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setHerdView("archive")}>Archive</button>
            </div>

            {herdView === "current" ? (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 font-semibold">Females</div>
                  <div className="grid gap-2">
                    {femaleAnimals.map((animal) => (
                      <button key={animal.id} className={`rounded-xl border px-3 py-3 text-left ${selectedId === animal.id ? "border-emerald-600 bg-emerald-50" : "border-emerald-100 bg-white hover:bg-emerald-50"}`} onClick={() => { setSelectedId(animal.id); setDetailTab("pedigree"); }}>
                        <div className="font-semibold">{animal.tagNo}</div>
                        <div className="text-sm text-slate-600">{animal.breed} · {getFemaleLifecycle(animal)}</div>
                      </button>
                    ))}
                    {femaleAnimals.length === 0 && <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-500">No female animals in current herd.</div>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 font-semibold">Males</div>
                  <div className="grid gap-2">
                    {maleAnimals.map((animal) => (
                      <button key={animal.id} className={`rounded-xl border px-3 py-3 text-left ${selectedId === animal.id ? "border-emerald-600 bg-emerald-50" : "border-emerald-100 bg-white hover:bg-emerald-50"}`} onClick={() => { setSelectedId(animal.id); setDetailTab("pedigree"); }}>
                        <div className="font-semibold">{animal.tagNo}</div>
                        <div className="text-sm text-slate-600">{animal.breed} · {animal.isBreedingBull === "Yes" ? `Breeding Bull (${animal.breedingSet || "Set blank"})` : "Male"}</div>
                      </button>
                    ))}
                    {maleAnimals.length === 0 && <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-500">No male animals in current herd.</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 font-semibold">Archived Females</div>
                  <div className="grid gap-2">
                    {archivedFemaleAnimals.map((animal) => (
                      <button key={animal.id} className={`rounded-xl border px-3 py-3 text-left ${selectedId === animal.id ? "border-emerald-600 bg-emerald-50" : "border-emerald-100 bg-white hover:bg-emerald-50"}`} onClick={() => { setSelectedId(animal.id); setDetailTab("pedigree"); }}>
                        <div className="font-semibold">{animal.tagNo}</div>
                        <div className="text-sm text-slate-600">{animal.status} · {animal.exitDate || "No exit date"}</div>
                      </button>
                    ))}
                    {archivedFemaleAnimals.length === 0 && <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-500">No archived female animals.</div>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 font-semibold">Archived Males</div>
                  <div className="grid gap-2">
                    {archivedMaleAnimals.map((animal) => (
                      <button key={animal.id} className={`rounded-xl border px-3 py-3 text-left ${selectedId === animal.id ? "border-emerald-600 bg-emerald-50" : "border-emerald-100 bg-white hover:bg-emerald-50"}`} onClick={() => { setSelectedId(animal.id); setDetailTab("pedigree"); }}>
                        <div className="font-semibold">{animal.tagNo}</div>
                        <div className="text-sm text-slate-600">{animal.status} · {animal.exitDate || "No exit date"}</div>
                      </button>
                    ))}
                    {archivedMaleAnimals.length === 0 && <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-500">No archived male animals.</div>}
                  </div>
                </div>
              </div>
            )}
          </Section>

          <div className="grid gap-5">
            <Section title="Selected Animal Preview">
              {selectedAnimal ? (
                <div>
                  <div className="mb-3 flex justify-end"><button className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-emerald-800 hover:bg-emerald-50" onClick={startEditAnimal}>Edit Animal</button></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><span className="font-medium">Tag No.:</span> {selectedAnimal.tagNo}</div>
                    <div><span className="font-medium">Breed:</span> {selectedAnimal.breed}</div>
                    <div><span className="font-medium">DOB:</span> {selectedAnimal.dob || "—"}</div>
                    <div><span className="font-medium">Sex:</span> {selectedAnimal.category}</div>
                    <div><span className="font-medium">Status:</span> {selectedAnimal.status}</div>
                    <div><span className="font-medium">Identification Mark:</span> {selectedAnimal.identificationMark || "—"}</div>
                    <div><span className="font-medium">Current female category:</span> {selectedAnimal.category === "Female" ? getFemaleLifecycle(selectedAnimal) : "—"}</div>
                    {selectedAnimal.category === "Male" && <div><span className="font-medium">Breeding bull:</span> {selectedAnimal.isBreedingBull === "Yes" ? `Yes (${selectedAnimal.breedingSet || "Set blank"})` : "No"}</div>}
                    {selectedAnimal.status !== "Active (present in herd)" && (
                      <>
                        <div><span className="font-medium">Date of Death / Culling:</span> {selectedAnimal.exitDate || "—"}</div>
                        <div><span className="font-medium">Reason of Death / Culling:</span> {selectedAnimal.exitReason || "—"}</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">No animal selected.</div>
              )}
            </Section>

            {selectedAnimal?.category === "Female" && (
              <Section title="Female Animal Tabs">
                <div className="mb-4 flex flex-wrap gap-2">
                  {FEMALE_TABS.map((tabName) => (
                    <button key={tabName} className={`rounded-xl border px-3 py-2 capitalize ${detailTab === tabName ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setDetailTab(tabName)}>
                      {tabName === "history" ? "overall history sheet" : tabName}
                    </button>
                  ))}
                </div>

                {detailTab === "pedigree" && (
                  <Grid>
                    <TextField label="Sire" value={selectedAnimal.femaleDetails.pedigree.sire} onChange={(v) => updateFemalePedigree("sire", v)} />
                    <TextField label="Dam" value={selectedAnimal.femaleDetails.pedigree.dam} onChange={(v) => updateFemalePedigree("dam", v)} />
                    <TextField label="Sire's sire" value={selectedAnimal.femaleDetails.pedigree.sireSire} onChange={(v) => updateFemalePedigree("sireSire", v)} />
                    <TextField label="Sire's dam" value={selectedAnimal.femaleDetails.pedigree.sireDam} onChange={(v) => updateFemalePedigree("sireDam", v)} />
                    <TextField label="Dam's sire" value={selectedAnimal.femaleDetails.pedigree.damSire} onChange={(v) => updateFemalePedigree("damSire", v)} />
                    <TextField label="Dam's dam" value={selectedAnimal.femaleDetails.pedigree.damDam} onChange={(v) => updateFemalePedigree("damDam", v)} />
                    <TextField label="Great-grandsire (SSS)" value={selectedAnimal.femaleDetails.pedigree.sireSireSire} onChange={(v) => updateFemalePedigree("sireSireSire", v)} />
                    <TextField label="Great-granddam (SSD)" value={selectedAnimal.femaleDetails.pedigree.sireSireDam} onChange={(v) => updateFemalePedigree("sireSireDam", v)} />
                    <TextField label="Great-grandsire (SDS)" value={selectedAnimal.femaleDetails.pedigree.sireDamSire} onChange={(v) => updateFemalePedigree("sireDamSire", v)} />
                    <TextField label="Great-granddam (SDD)" value={selectedAnimal.femaleDetails.pedigree.sireDamDam} onChange={(v) => updateFemalePedigree("sireDamDam", v)} />
                    <TextField label="Great-grandsire (DSS)" value={selectedAnimal.femaleDetails.pedigree.damSireSire} onChange={(v) => updateFemalePedigree("damSireSire", v)} />
                    <TextField label="Great-granddam (DSD)" value={selectedAnimal.femaleDetails.pedigree.damSireDam} onChange={(v) => updateFemalePedigree("damSireDam", v)} />
                    <TextField label="Great-grandsire (DDS)" value={selectedAnimal.femaleDetails.pedigree.damDamSire} onChange={(v) => updateFemalePedigree("damDamSire", v)} />
                    <TextField label="Great-granddam (DDD)" value={selectedAnimal.femaleDetails.pedigree.damDamDam} onChange={(v) => updateFemalePedigree("damDamDam", v)} />
                  </Grid>
                )}

                {detailTab === "reproduction" && selectedReproParity && reproSummary && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="flex flex-col gap-1 text-sm">
                          <span>Repro parity</span>
                          <div className="flex items-center gap-2">
                            <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300 bg-white text-3xl font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50" onClick={decrementReproParity} disabled={Number(selectedAnimal.femaleDetails.selectedReproParity || 0) <= 0}>−</button>
                            <input className="w-24 rounded-xl border border-emerald-200 px-3 py-2 text-center font-semibold focus:border-emerald-500 focus:outline-none" value={selectedAnimal.femaleDetails.selectedReproParity} readOnly />
                            <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300 bg-white text-3xl font-bold text-emerald-800 hover:bg-emerald-50" onClick={incrementReproParity}>+</button>
                          </div>
                        </div>
                        <TextField label="Stage" value={reproSummary.parityLabel} onChange={() => {}} readOnly />
                        <TextField label="Last AI date" value={reproSummary.lastAIDate || ""} onChange={() => {}} readOnly />
                        <DateField label="Conception date" value={selectedReproParity.conceptionDate || ""} onChange={(v) => updateSelectedRepro("conceptionDate", v)} />
                        <TextField label="Expected calving date" value={selectedReproParity.expectedCalvingDate || ""} onChange={() => {}} readOnly />
                        <TextField label="Number of services" value={String(reproSummary.services)} onChange={() => {}} readOnly />
                      </div>
                      <div className="mt-3"><AreaField label="Remarks" value={selectedReproParity.remarks || ""} onChange={(v) => updateSelectedRepro("remarks", v)} rows={3} /></div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                      <div className="mb-3 text-base font-semibold text-emerald-900">Mate Selection</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-emerald-50 text-left text-emerald-900">
                              <th className="border border-emerald-100 px-2 py-2">Bull No.</th>
                              <th className="border border-emerald-100 px-2 py-2">Set No.</th>
                              <th className="border border-emerald-100 px-2 py-2">Estimated Inbreeding %</th>
                              <th className="border border-emerald-100 px-2 py-2">Status</th>
                              <th className="border border-emerald-100 px-2 py-2">Reason</th>
                              <th className="border border-emerald-100 px-2 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mateSelectionRows.map((row) => (
                              <tr key={row.bull.id}>
                                <td className="border border-emerald-100 px-2 py-2">{row.bull.tagNo}</td>
                                <td className="border border-emerald-100 px-2 py-2">{row.bull.breedingSet || "—"}</td>
                                <td className="border border-emerald-100 px-2 py-2">{row.inbreedingPct}</td>
                                <td className="border border-emerald-100 px-2 py-2">{row.status}</td>
                                <td className="border border-emerald-100 px-2 py-2">{row.reason}</td>
                                <td className="border border-emerald-100 px-2 py-2">
                                  {row.status !== "Avoid" ? (
                                    <button
                                      className="rounded-xl border border-emerald-300 bg-white px-3 py-1 text-emerald-800 hover:bg-emerald-50"
                                      onClick={() => applyBullToSelectedParity(row.bull)}
                                    >
                                      Use
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">Blocked</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {mateSelectionRows.length === 0 && (
                              <tr>
                                <td colSpan={6} className="border border-emerald-100 px-2 py-3 text-center text-slate-500">
                                  No active breeding bulls available.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 font-semibold">AI details in selected parity</div>
                      <div className="grid gap-3">
                        {selectedReproParity.aiRecords.length === 0 ? <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-500">No AI attempts entered yet for this parity.</div> : selectedReproParity.aiRecords.map((rec, idx) => (
                          <div key={`ai-${idx}`} className="rounded-2xl border border-emerald-100 bg-white p-3">
                            <Grid>
                              <DateField label={`AI ${idx + 1} date`} value={rec.aiDate || ""} onChange={(v) => updateAIRecord(idx, "aiDate", v)} />
                              <TextField label="Bull No." value={rec.aiBullNo || ""} onChange={(v) => updateAIRecord(idx, "aiBullNo", v)} />
                              <TextField label="Set No." value={rec.aiSetNo || ""} onChange={(v) => updateAIRecord(idx, "aiSetNo", v)} />
                              <SelectField label="Result" value={rec.result || "Pending"} onChange={(v) => updateAIRecord(idx, "result", v)} options={AI_RESULTS} />
                            </Grid>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-4xl font-bold text-white hover:bg-emerald-700" onClick={addAIRecord}>+</button>
                        <button className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-4xl font-bold text-slate-700 hover:bg-slate-50" onClick={removeAIRecord}>−</button>
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === "calving" && (
                  <div className="space-y-4">
                    {selectedAnimal.femaleDetails.calvingParities.map((cp, idx) => {
                      const metrics = computeCalvingMetrics(selectedAnimal, cp.parityNo);
                      const autoCalfSire = getCalfSireForCalving(selectedAnimal, cp.parityNo);
                      const showNormalFields = cp.calvingOutcome === "Normal calving";
                      return (
                        <div key={`calving-${cp.parityNo}`} className="rounded-2xl border border-emerald-100 bg-white p-4">
                          <div className="mb-3 text-base font-semibold text-emerald-900">Calving parity {cp.parityNo}</div>
                          <Grid>
                            <DateField label="Calving date" value={cp.calvingDate || ""} onChange={(v) => updateCalvingParity(idx, "calvingDate", v)} />
                            <SelectField label="Calving outcome" value={cp.calvingOutcome || "Normal calving"} onChange={(v) => updateCalvingParity(idx, "calvingOutcome", v)} options={CALVING_OUTCOMES} />
                            <TextField label="AFC (days)" value={metrics.afc ?? ""} onChange={() => {}} readOnly />
                            <TextField label="Gestation period (days)" value={metrics.gestationPeriod ?? ""} onChange={() => {}} readOnly />
                            <TextField label="Service period (days)" value={metrics.servicePeriod ?? ""} onChange={() => {}} readOnly />
                            <TextField label="Calving interval (days)" value={metrics.calvingInterval ?? ""} onChange={() => {}} readOnly />
                            {showNormalFields && (
                              <>
                                <SelectField label="Calf sex" value={cp.calfSex || ""} onChange={(v) => updateCalvingParity(idx, "calfSex", v)} options={["", ...SEX_OPTIONS]} />
                                <TextField label="Calf tag no. (auto-adds calf to herd)" value={cp.calfTag || ""} onChange={(v) => updateCalvingParity(idx, "calfTag", v)} />
                                <TextField label="Calf sire (auto)" value={autoCalfSire || cp.calfSire || ""} onChange={() => {}} readOnly />
                              </>
                            )}
                          </Grid>
                          <div className="mt-3"><AreaField label="Remarks" value={cp.remarks || ""} onChange={(v) => updateCalvingParity(idx, "remarks", v)} rows={3} /></div>
                        </div>
                      );
                    })}
                    <div className="flex gap-3">
                      <button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-4xl font-bold text-white hover:bg-emerald-700" onClick={incrementCalvingParity}>+</button>
                      <button className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-4xl font-bold text-slate-700 hover:bg-slate-50" onClick={decrementCalvingParity}>−</button>
                    </div>
                  </div>
                )}

                {detailTab === "production" && selectedLactation && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                      <Grid>
                        <SelectField label="Select parity" value={selectedAnimal.femaleDetails.selectedProductionParity} onChange={selectProductionParity} options={selectedAnimal.femaleDetails.productionLactations.map((l) => String(l.parityNo))} />
                        <DateField label="Calving date" value={selectedLactation.calvingDate || ""} onChange={() => {}} readOnly />
                        <DateField label="Dry date" value={selectedLactation.dryDate || ""} onChange={(v) => updateSelectedLactation("dryDate", v)} />
                        <SelectField label="Entry mode" value={selectedLactation.entryMode || "Manual"} onChange={(v) => updateSelectedLactation("entryMode", v)} options={ENTRY_MODES} />
                        <TextField label="Lactation length (days)" value={productionMetrics.lactationLength || ""} onChange={() => {}} readOnly />
                        <TextField label="Peak yield" value={productionMetrics.peakYield || ""} onChange={() => {}} readOnly />
                      </Grid>
                    </div>
                    {selectedLactation.entryMode === "Manual" ? (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4"><Grid><TextField label="Total lactation milk" value={selectedLactation.manualSummary.totalLactationMilk || ""} onChange={(v) => updateManualSummary("totalLactationMilk", v)} /><TextField label="Standard lactation milk" value={selectedLactation.manualSummary.standardLactationMilk || ""} onChange={(v) => updateManualSummary("standardLactationMilk", v)} /><TextField label="Peak yield" value={selectedLactation.manualSummary.peakYield || ""} onChange={(v) => updateManualSummary("peakYield", v)} /></Grid></div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                          <div className="mb-3 text-sm text-slate-600">First recordable Friday: {firstRecordableFriday(selectedLactation.calvingDate) || "—"}</div>
                          <div className="grid gap-3">
                            {(selectedLactation.fridayRecords || []).length === 0 ? <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-500">Press + to generate the first recordable Friday and successive Friday rows.</div> : selectedLactation.fridayRecords.map((rec, idx) => (
                              <div key={`fr-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                                <Grid>
                                  <TextField label={`Friday ${idx + 1} date`} value={rec.date || ""} onChange={() => {}} readOnly />
                                  <TextField label="Morning milk" value={rec.morningMilk || ""} onChange={(v) => updateFridayRecord(idx, "morningMilk", v)} />
                                  <TextField label="Evening milk" value={rec.eveningMilk || ""} onChange={(v) => updateFridayRecord(idx, "eveningMilk", v)} />
                                  <TextField label="Total Daily Yield" value={rec.totalDailyYield || ""} onChange={() => {}} readOnly />
                                  <TextField label="Fat %" value={rec.fatPct || ""} onChange={(v) => updateFridayRecord(idx, "fatPct", v)} />
                                  <TextField label="SNF %" value={rec.snfPct || ""} onChange={(v) => updateFridayRecord(idx, "snfPct", v)} />
                                  <TextField label="TS %" value={rec.tsPct || ""} onChange={(v) => updateFridayRecord(idx, "tsPct", v)} />
                                </Grid>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-3"><button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-4xl font-bold text-white hover:bg-emerald-700" onClick={addFridayRecord}>+</button><button className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-4xl font-bold text-slate-700 hover:bg-slate-50" onClick={removeFridayRecord}>−</button></div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3"><StatCard title="Total lactation milk" value={productionMetrics.totalLactationMilk.toFixed(1)} /><StatCard title="Standard lactation milk" value={productionMetrics.standardLactationMilk.toFixed(1)} /><StatCard title="Peak yield" value={productionMetrics.peakYield.toFixed(1)} /></div>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === "health" && selectedHealth && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {HEALTH_SUBTABS.map((sub) => <button key={sub.id} className={`rounded-xl border px-3 py-2 ${healthSubTab === sub.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setHealthSubTab(sub.id)}>{sub.label}</button>)}
                    </div>
                    {healthSubTab === "bodyWeight" && (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Body weight and recording date</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(femaleTarget, "bodyWeightRecords", makeBodyWeightRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(femaleTarget, "bodyWeightRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.bodyWeightRecords.map((rec, idx) => <div key={`bw-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Recording date" value={rec.recordDate || ""} onChange={(v) => updateHealthRecord(femaleTarget, "bodyWeightRecords", idx, "recordDate", v)} /><TextField label="Body weight" value={rec.bodyWeight || ""} onChange={(v) => updateHealthRecord(femaleTarget, "bodyWeightRecords", idx, "bodyWeight", v)} /></Grid></div>)}</div></div>
                    )}
                    {healthSubTab === "deworming" && (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Deworming date and anthelmintic used</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(femaleTarget, "dewormingRecords", makeDewormingRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(femaleTarget, "dewormingRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.dewormingRecords.map((rec, idx) => <div key={`dw-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Deworming date" value={rec.dewormingDate || ""} onChange={(v) => updateHealthRecord(femaleTarget, "dewormingRecords", idx, "dewormingDate", v)} /><TextField label="Anthelmintic used" value={rec.anthelminticUsed || ""} onChange={(v) => updateHealthRecord(femaleTarget, "dewormingRecords", idx, "anthelminticUsed", v)} /></Grid></div>)}</div></div>
                    )}
                    {healthSubTab === "vaccination" && (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Vaccination date and vaccine used</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(femaleTarget, "vaccinationRecords", makeVaccinationRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(femaleTarget, "vaccinationRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.vaccinationRecords.map((rec, idx) => <div key={`vac-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Vaccination date" value={rec.vaccinationDate || ""} onChange={(v) => updateHealthRecord(femaleTarget, "vaccinationRecords", idx, "vaccinationDate", v)} /><TextField label="Vaccine used" value={rec.vaccineUsed || ""} onChange={(v) => updateHealthRecord(femaleTarget, "vaccinationRecords", idx, "vaccineUsed", v)} /></Grid></div>)}</div></div>
                    )}
                    {healthSubTab === "treatment" && (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Treatment dates, diagnosis and treatment given</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(femaleTarget, "treatmentRecords", makeTreatmentRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(femaleTarget, "treatmentRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.treatmentRecords.map((rec, idx) => <div key={`tx-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Treatment date" value={rec.treatmentDate || ""} onChange={(v) => updateHealthRecord(femaleTarget, "treatmentRecords", idx, "treatmentDate", v)} /><TextField label="Diagnosis" value={rec.diagnosis || ""} onChange={(v) => updateHealthRecord(femaleTarget, "treatmentRecords", idx, "diagnosis", v)} /><TextField label="Treatment given" value={rec.treatmentGiven || ""} onChange={(v) => updateHealthRecord(femaleTarget, "treatmentRecords", idx, "treatmentGiven", v)} /></Grid></div>)}</div></div>
                    )}
                  </div>
                )}

                {detailTab === "history" && (
                  <div className="space-y-4">
                    <Grid>
                      <TextField label="AFC (days)" value={String(afcValue || "")} onChange={() => {}} readOnly />
                      <TextField label="Reason for culling" value={selectedAnimal.femaleDetails.historyMeta.reasonForCulling || ""} onChange={(v) => updateFemaleHistoryMeta("reasonForCulling", v)} />
                      <TextField label="Book value" value={selectedAnimal.femaleDetails.historyMeta.bookValue || ""} onChange={(v) => updateFemaleHistoryMeta("bookValue", v)} />
                    </Grid>
                    <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-3"><table className="min-w-full border-collapse text-sm"><thead><tr className="bg-emerald-50 text-left text-emerald-900">{["Parity","Date Calved","GP","Sex of Calf","Tag No. of Calf","Date of 1st AI","Date of Conception","Bull No./Set No.","Total AI","Dry Date","TLMY","SLMY","LL","PY","SP","CI"].map((h) => <th key={h} className="whitespace-nowrap border border-emerald-100 px-2 py-2">{h}</th>)}</tr></thead><tbody>{historyRows.map((row, idx) => <tr key={`hist-${idx}`} className="hover:bg-emerald-50/50"><td className="border border-emerald-100 px-2 py-2">{row.parity}</td><td className="border border-emerald-100 px-2 py-2">{row.dateCalved}</td><td className="border border-emerald-100 px-2 py-2">{row.gp}</td><td className="border border-emerald-100 px-2 py-2">{row.sexOfCalf}</td><td className="border border-emerald-100 px-2 py-2">{row.calfTag}</td><td className="border border-emerald-100 px-2 py-2">{row.firstAI}</td><td className="border border-emerald-100 px-2 py-2">{row.conceptionDate}</td><td className="border border-emerald-100 px-2 py-2">{row.bullNo}</td><td className="border border-emerald-100 px-2 py-2">{row.totalAI}</td><td className="border border-emerald-100 px-2 py-2">{row.dryDate}</td><td className="border border-emerald-100 px-2 py-2">{row.tlmy}</td><td className="border border-emerald-100 px-2 py-2">{row.slmy}</td><td className="border border-emerald-100 px-2 py-2">{row.ll}</td><td className="border border-emerald-100 px-2 py-2">{row.py}</td><td className="border border-emerald-100 px-2 py-2">{row.sp}</td><td className="border border-emerald-100 px-2 py-2">{row.ci}</td></tr>)}</tbody></table></div>
                  </div>
                )}

                <div className="mt-4 flex justify-end"><button className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-emerald-800 hover:bg-emerald-50" onClick={() => setDetailTab(nextDetailTab(detailTab, FEMALE_TABS))}>Next Tab</button></div>
              </Section>
            )}

            {selectedAnimal?.category === "Male" && selectedAnimal?.isBreedingBull === "Yes" && (
              <Section title="Breeding Bull Tabs">
                <div className="mb-4 flex flex-wrap gap-2">
                  {MALE_TABS.map((tabName) => (
                    <button key={tabName} className={`rounded-xl border px-3 py-2 capitalize ${detailTab === tabName ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setDetailTab(tabName)}>
                      {tabName}
                    </button>
                  ))}
                </div>

                {detailTab === "pedigree" && (
                  <Grid>
                    <TextField label="Sire" value={selectedAnimal.maleDetails.pedigree.sire} onChange={(v) => updateMalePedigree("sire", v)} />
                    <TextField label="Dam" value={selectedAnimal.maleDetails.pedigree.dam} onChange={(v) => updateMalePedigree("dam", v)} />
                    <TextField label="Sire's sire" value={selectedAnimal.maleDetails.pedigree.sireSire} onChange={(v) => updateMalePedigree("sireSire", v)} />
                    <TextField label="Sire's dam" value={selectedAnimal.maleDetails.pedigree.sireDam} onChange={(v) => updateMalePedigree("sireDam", v)} />
                    <TextField label="Dam's sire" value={selectedAnimal.maleDetails.pedigree.damSire} onChange={(v) => updateMalePedigree("damSire", v)} />
                    <TextField label="Dam's dam" value={selectedAnimal.maleDetails.pedigree.damDam} onChange={(v) => updateMalePedigree("damDam", v)} />
                    <TextField label="Great-grandsire (SSS)" value={selectedAnimal.maleDetails.pedigree.sireSireSire} onChange={(v) => updateMalePedigree("sireSireSire", v)} />
                    <TextField label="Great-granddam (SSD)" value={selectedAnimal.maleDetails.pedigree.sireSireDam} onChange={(v) => updateMalePedigree("sireSireDam", v)} />
                    <TextField label="Great-grandsire (SDS)" value={selectedAnimal.maleDetails.pedigree.sireDamSire} onChange={(v) => updateMalePedigree("sireDamSire", v)} />
                    <TextField label="Great-granddam (SDD)" value={selectedAnimal.maleDetails.pedigree.sireDamDam} onChange={(v) => updateMalePedigree("sireDamDam", v)} />
                    <TextField label="Great-grandsire (DSS)" value={selectedAnimal.maleDetails.pedigree.damSireSire} onChange={(v) => updateMalePedigree("damSireSire", v)} />
                    <TextField label="Great-granddam (DSD)" value={selectedAnimal.maleDetails.pedigree.damSireDam} onChange={(v) => updateMalePedigree("damSireDam", v)} />
                    <TextField label="Great-grandsire (DDS)" value={selectedAnimal.maleDetails.pedigree.damDamSire} onChange={(v) => updateMalePedigree("damDamSire", v)} />
                    <TextField label="Great-granddam (DDD)" value={selectedAnimal.maleDetails.pedigree.damDamDam} onChange={(v) => updateMalePedigree("damDamDam", v)} />
                  </Grid>
                )}

                {detailTab === "disease testing" && (
                  <div className="space-y-4">
                    {(selectedAnimal.maleDetails.diseaseTests || []).map((rec, idx) => (
                      <div key={`dt-${idx}`} className="rounded-2xl border border-emerald-100 bg-white p-3">
                        <Grid>
                          <DateField label="Testing date" value={rec.testDate || ""} onChange={(v) => updateDiseaseTest(idx, "testDate", v)} />
                          <TextField label="Disease / test" value={rec.testName || ""} onChange={(v) => updateDiseaseTest(idx, "testName", v)} />
                          <TextField label="Result" value={rec.result || ""} onChange={(v) => updateDiseaseTest(idx, "result", v)} />
                          <AreaField label="Remarks" value={rec.remarks || ""} onChange={(v) => updateDiseaseTest(idx, "remarks", v)} rows={2} />
                        </Grid>
                      </div>
                    ))}
                    <div className="flex gap-3"><button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-4xl font-bold text-white hover:bg-emerald-700" onClick={addDiseaseTest}>+</button><button className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-4xl font-bold text-slate-700 hover:bg-slate-50" onClick={removeDiseaseTest}>−</button></div>
                  </div>
                )}

                {detailTab === "progenies born" && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button className={`rounded-xl border px-3 py-2 ${maleProgenySubTab === "female" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setMaleProgenySubTab("female")}>Female progenies</button>
                      <button className={`rounded-xl border px-3 py-2 ${maleProgenySubTab === "male" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setMaleProgenySubTab("male")}>Male progenies</button>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-3">
                      <table className="min-w-full border-collapse text-sm">
                        <thead><tr className="bg-emerald-50 text-left text-emerald-900">{["Tag No.", "DOB", "Breed", "Status", "Archived?"].map((h) => <th key={h} className="border border-emerald-100 px-2 py-2">{h}</th>)}</tr></thead>
                        <tbody>
                          {(maleProgenySubTab === "female" ? femaleProgenies : maleProgenies).map((p) => (
                            <tr key={p.id}><td className="border border-emerald-100 px-2 py-2">{p.tagNo}</td><td className="border border-emerald-100 px-2 py-2">{p.dob}</td><td className="border border-emerald-100 px-2 py-2">{p.breed}</td><td className="border border-emerald-100 px-2 py-2">{p.category === "Female" ? getFemaleLifecycle(p) : "Male"}</td><td className="border border-emerald-100 px-2 py-2">{isArchivedAnimal(p) ? "Yes" : "No"}</td></tr>
                          ))}
                          {(maleProgenySubTab === "female" ? femaleProgenies : maleProgenies).length === 0 && <tr><td colSpan={5} className="border border-emerald-100 px-2 py-3 text-center text-slate-500">No progenies linked to this bull yet.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailTab === "performance of daughters" && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button className={`rounded-xl border px-3 py-2 ${daughterPerfSubTab === "production" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setDaughterPerfSubTab("production")}>Production</button>
                      <button className={`rounded-xl border px-3 py-2 ${daughterPerfSubTab === "reproduction" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setDaughterPerfSubTab("reproduction")}>Reproduction</button>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-3">
                      {daughterPerfSubTab === "production" ? (
                        <table className="min-w-full border-collapse text-sm">
                          <thead><tr className="bg-emerald-50 text-left text-emerald-900">{["Daughter", "Current category", "Parity count", "Latest TLMY", "Latest SLMY", "Peak yield"].map((h) => <th key={h} className="border border-emerald-100 px-2 py-2">{h}</th>)}</tr></thead>
                          <tbody>
                            {femaleProgenies.map((d) => {
                              const lactations = d.femaleDetails.productionLactations || [];
                              const latest = lactations.length ? lactations[lactations.length - 1] : null;
                              const metrics = latest ? computeProductionMetrics(latest) : { totalLactationMilk: 0, standardLactationMilk: 0, peakYield: 0 };
                              return <tr key={d.id}><td className="border border-emerald-100 px-2 py-2">{d.tagNo}</td><td className="border border-emerald-100 px-2 py-2">{getFemaleLifecycle(d)}</td><td className="border border-emerald-100 px-2 py-2">{d.femaleDetails.calvingParities.filter((p) => p.calvingDate).length}</td><td className="border border-emerald-100 px-2 py-2">{latest ? metrics.totalLactationMilk.toFixed(1) : ""}</td><td className="border border-emerald-100 px-2 py-2">{latest ? metrics.standardLactationMilk.toFixed(1) : ""}</td><td className="border border-emerald-100 px-2 py-2">{latest ? metrics.peakYield.toFixed(1) : ""}</td></tr>;
                            })}
                            {femaleProgenies.length === 0 && <tr><td colSpan={6} className="border border-emerald-100 px-2 py-3 text-center text-slate-500">No female progenies available yet.</td></tr>}
                          </tbody>
                        </table>
                      ) : (
                        <table className="min-w-full border-collapse text-sm">
                          <thead><tr className="bg-emerald-50 text-left text-emerald-900">{["Daughter", "Current category", "Last AI date", "Conception date", "Services", "Calvings"].map((h) => <th key={h} className="border border-emerald-100 px-2 py-2">{h}</th>)}</tr></thead>
                          <tbody>
                            {femaleProgenies.map((d) => {
                              const latestRepro = d.femaleDetails.reproductionParities.length ? d.femaleDetails.reproductionParities[d.femaleDetails.reproductionParities.length - 1] : null;
                              const summary = latestRepro ? computeReproSummary(d, latestRepro) : { lastAIDate: "", services: 0 };
                              return <tr key={d.id}><td className="border border-emerald-100 px-2 py-2">{d.tagNo}</td><td className="border border-emerald-100 px-2 py-2">{getFemaleLifecycle(d)}</td><td className="border border-emerald-100 px-2 py-2">{summary.lastAIDate}</td><td className="border border-emerald-100 px-2 py-2">{latestRepro?.conceptionDate || ""}</td><td className="border border-emerald-100 px-2 py-2">{summary.services}</td><td className="border border-emerald-100 px-2 py-2">{d.femaleDetails.calvingParities.filter((p) => p.calvingDate).length}</td></tr>;
                            })}
                            {femaleProgenies.length === 0 && <tr><td colSpan={6} className="border border-emerald-100 px-2 py-3 text-center text-slate-500">No female progenies available yet.</td></tr>}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === "health" && selectedHealth && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">{HEALTH_SUBTABS.map((sub) => <button key={sub.id} className={`rounded-xl border px-3 py-2 ${healthSubTab === sub.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`} onClick={() => setHealthSubTab(sub.id)}>{sub.label}</button>)}</div>
                    {healthSubTab === "bodyWeight" && <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Body weight and recording date</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(maleTarget, "bodyWeightRecords", makeBodyWeightRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(maleTarget, "bodyWeightRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.bodyWeightRecords.map((rec, idx) => <div key={`mbw-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Recording date" value={rec.recordDate || ""} onChange={(v) => updateHealthRecord(maleTarget, "bodyWeightRecords", idx, "recordDate", v)} /><TextField label="Body weight" value={rec.bodyWeight || ""} onChange={(v) => updateHealthRecord(maleTarget, "bodyWeightRecords", idx, "bodyWeight", v)} /></Grid></div>)}</div></div>}
                    {healthSubTab === "deworming" && <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Deworming date and anthelmintic used</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(maleTarget, "dewormingRecords", makeDewormingRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(maleTarget, "dewormingRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.dewormingRecords.map((rec, idx) => <div key={`mdw-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Deworming date" value={rec.dewormingDate || ""} onChange={(v) => updateHealthRecord(maleTarget, "dewormingRecords", idx, "dewormingDate", v)} /><TextField label="Anthelmintic used" value={rec.anthelminticUsed || ""} onChange={(v) => updateHealthRecord(maleTarget, "dewormingRecords", idx, "anthelminticUsed", v)} /></Grid></div>)}</div></div>}
                    {healthSubTab === "vaccination" && <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Vaccination date and vaccine used</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(maleTarget, "vaccinationRecords", makeVaccinationRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(maleTarget, "vaccinationRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.vaccinationRecords.map((rec, idx) => <div key={`mv-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Vaccination date" value={rec.vaccinationDate || ""} onChange={(v) => updateHealthRecord(maleTarget, "vaccinationRecords", idx, "vaccinationDate", v)} /><TextField label="Vaccine used" value={rec.vaccineUsed || ""} onChange={(v) => updateHealthRecord(maleTarget, "vaccinationRecords", idx, "vaccineUsed", v)} /></Grid></div>)}</div></div>}
                    {healthSubTab === "treatment" && <div className="rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-emerald-900">Treatment dates, diagnosis and treatment given</div><div className="flex gap-3"><button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white hover:bg-emerald-700" onClick={() => addHealthRecord(maleTarget, "treatmentRecords", makeTreatmentRecord())}>+</button><button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-bold text-slate-700 hover:bg-slate-50" onClick={() => removeHealthRecord(maleTarget, "treatmentRecords")}>−</button></div></div><div className="grid gap-3">{selectedHealth.treatmentRecords.map((rec, idx) => <div key={`mt-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Grid><DateField label="Treatment date" value={rec.treatmentDate || ""} onChange={(v) => updateHealthRecord(maleTarget, "treatmentRecords", idx, "treatmentDate", v)} /><TextField label="Diagnosis" value={rec.diagnosis || ""} onChange={(v) => updateHealthRecord(maleTarget, "treatmentRecords", idx, "diagnosis", v)} /><TextField label="Treatment given" value={rec.treatmentGiven || ""} onChange={(v) => updateHealthRecord(maleTarget, "treatmentRecords", idx, "treatmentGiven", v)} /></Grid></div>)}</div></div>}
                  </div>
                )}

                {detailTab === "overall history sheet" && (
                  <div className="space-y-4">
                    <Grid>
                      <TextField label="Breeding set" value={selectedAnimal.breedingSet || ""} onChange={() => {}} readOnly />
                      <TextField label="Female progenies" value={String(femaleProgenies.length)} onChange={() => {}} readOnly />
                      <TextField label="Male progenies" value={String(maleProgenies.length)} onChange={() => {}} readOnly />
                    </Grid>
                    <AreaField label="Remarks" value={selectedAnimal.maleDetails.historyMeta.remarks || ""} onChange={(v) => updateMaleHistoryMeta("remarks", v)} />
                    <TextField label="Book value" value={selectedAnimal.maleDetails.historyMeta.bookValue || ""} onChange={(v) => updateMaleHistoryMeta("bookValue", v)} />
                    <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-3">
                      <table className="min-w-full border-collapse text-sm">
                        <thead><tr className="bg-emerald-50 text-left text-emerald-900">{["Disease test date", "Disease/test", "Result", "Remarks"].map((h) => <th key={h} className="border border-emerald-100 px-2 py-2">{h}</th>)}</tr></thead>
                        <tbody>
                          {selectedAnimal.maleDetails.diseaseTests.map((r, idx) => <tr key={`ht-${idx}`}><td className="border border-emerald-100 px-2 py-2">{r.testDate}</td><td className="border border-emerald-100 px-2 py-2">{r.testName}</td><td className="border border-emerald-100 px-2 py-2">{r.result}</td><td className="border border-emerald-100 px-2 py-2">{r.remarks}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-end"><button className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-emerald-800 hover:bg-emerald-50" onClick={() => setDetailTab(nextDetailTab(detailTab, MALE_TABS))}>Next Tab</button></div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
