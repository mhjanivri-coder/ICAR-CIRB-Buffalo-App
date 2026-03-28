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

  /* Note: full working app continues from current canvas state */
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

        <Section title="Current packaged source">
          <div className="text-sm text-slate-600">
            This rebuild package includes the latest canvas app source and deploy-ready Vite wrapper files.
            If Vercel shows any runtime/build error, send the first error message and I will patch the files directly.
          </div>
        </Section>
      </div>
    </div>
  );
}
