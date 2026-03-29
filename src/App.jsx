import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "buffalo_phase9_clean";
const FEMALE_TABS = ["Pedigree", "Reproduction", "Calving", "Health", "History"];
const MALE_TABS = ["Pedigree", "Disease Testing", "AI Information", "Health", "History"];
const FEMALE_CATEGORIES = ["Heifer", "Milk", "Dry"];
const PD_OPTIONS = ["Not checked", "Pregnant", "Non-pregnant"];
const CALF_SEX_OPTIONS = ["Male", "Female"];
const AI_RESULT_OPTIONS = ["Pending", "Pregnant", "Non-pregnant", "Repeat", "Aborted"];

const EMPTY_FEMALE_DETAILS = {
  pedigree: { sire: "", dam: "" },
  reproduction: { parity: "0", aiDate: "", bullNo: "", setNo: "", pdStatus: "Not checked", conceptionDate: "", expectedCalvingDate: "", notes: "" },
  calving: { calvingDate: "", calfSex: "Male", calfTag: "", calfSire: "", calfCreated: "No", notes: "" },
  health: { bodyWeights: [], dewormings: [], vaccinations: [], treatments: [], notes: "" },
  history: { notes: "" },
};

const EMPTY_MALE_DETAILS = {
  selectedForBreeding: "No",
  breedingSetNo: "",
  pedigree: { sire: "", dam: "" },
  diseaseTesting: { notes: "" },
  aiInformation: [],
  health: { notes: "" },
  history: { notes: "" },
};

const EMPTY = {
  tag: "",
  sex: "Female",
  dob: "",
  status: "Active",
  exitDate: "",
  exitReason: "",
  femaleCategory: "Heifer",
  femaleDetails: EMPTY_FEMALE_DETAILS,
  maleDetails: EMPTY_MALE_DETAILS,
};

function addDaysToDateString(dateStr, days) {
  if (!dateStr || !dateStr.includes("/")) return "";
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  if (!dd || !mm || !yyyy) return "";
  const dt = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString("en-GB");
}

function buildCalfSire(reproduction) {
  const bullNo = reproduction?.bullNo || "";
  const setNo = reproduction?.setNo || "";
  if (bullNo && setNo) return `${bullNo}/${setNo}`;
  if (bullNo) return bullNo;
  if (setNo) return `Set ${setNo}`;
  return "";
}

function loadAnimals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function withDefaults(animal) {
  if (animal.sex === "Female") {
    const reproduction = {
      parity: animal.femaleDetails?.reproduction?.parity || "0",
      aiDate: animal.femaleDetails?.reproduction?.aiDate || "",
      bullNo: animal.femaleDetails?.reproduction?.bullNo || "",
      setNo: animal.femaleDetails?.reproduction?.setNo || "",
      pdStatus: animal.femaleDetails?.reproduction?.pdStatus || "Not checked",
      conceptionDate: animal.femaleDetails?.reproduction?.conceptionDate || "",
      expectedCalvingDate: animal.femaleDetails?.reproduction?.expectedCalvingDate || addDaysToDateString(animal.femaleDetails?.reproduction?.conceptionDate || "", 310),
      notes: animal.femaleDetails?.reproduction?.notes || "",
    };
    return {
      ...animal,
      femaleCategory: animal.femaleCategory || "Heifer",
      femaleDetails: {
        pedigree: { sire: animal.femaleDetails?.pedigree?.sire || "", dam: animal.femaleDetails?.pedigree?.dam || "" },
        reproduction,
        calving: {
          calvingDate: animal.femaleDetails?.calving?.calvingDate || "",
          calfSex: animal.femaleDetails?.calving?.calfSex || "Male",
          calfTag: animal.femaleDetails?.calving?.calfTag || "",
          calfSire: animal.femaleDetails?.calving?.calfSire || buildCalfSire(reproduction),
          calfCreated: animal.femaleDetails?.calving?.calfCreated || "No",
          notes: animal.femaleDetails?.calving?.notes || "",
        },
        health: {
          bodyWeights: animal.femaleDetails?.health?.bodyWeights || [],
          dewormings: animal.femaleDetails?.health?.dewormings || [],
          vaccinations: animal.femaleDetails?.health?.vaccinations || [],
          treatments: animal.femaleDetails?.health?.treatments || [],
          notes: animal.femaleDetails?.health?.notes || "",
        },
        history: { notes: animal.femaleDetails?.history?.notes || "" },
      },
      maleDetails: undefined,
    };
  }
  return {
    ...animal,
    femaleCategory: "",
    femaleDetails: undefined,
    maleDetails: {
      selectedForBreeding: animal.maleDetails?.selectedForBreeding || "No",
      breedingSetNo: animal.maleDetails?.breedingSetNo || "",
      pedigree: { sire: animal.maleDetails?.pedigree?.sire || "", dam: animal.maleDetails?.pedigree?.dam || "" },
      diseaseTesting: { notes: animal.maleDetails?.diseaseTesting?.notes || "" },
      aiInformation: animal.maleDetails?.aiInformation || [],
      health: { notes: animal.maleDetails?.health?.notes || "" },
      history: { notes: animal.maleDetails?.history?.notes || "" },
    },
  };
}

function normalizeAnimal(animal) {
  const next = withDefaults(animal);
  if (next.status === "Active") {
    next.exitDate = "";
    next.exitReason = "";
  }
  if (next.sex === "Male" && next.maleDetails?.selectedForBreeding !== "Yes") {
    next.maleDetails.breedingSetNo = "";
  }
  return next;
}

function isArchived(animal) {
  return animal.status === "Dead" || animal.status === "Culled";
}

function getAnimalSummary(animal) {
  if (!animal) return "";
  if (animal.sex === "Male") {
    const breeding = animal.maleDetails?.selectedForBreeding || "No";
    const setNo = animal.maleDetails?.breedingSetNo || "-";
    const aiCount = animal.maleDetails?.aiInformation?.length || 0;
    return `Male · Breeding ${breeding}${breeding === "Yes" ? ` · Set ${setNo}` : ""} · AI records ${aiCount}`;
  }
  const parity = animal.femaleDetails?.reproduction?.parity || "0";
  const pd = animal.femaleDetails?.reproduction?.pdStatus || "Not checked";
  const calfCreated = animal.femaleDetails?.calving?.calfCreated || "No";
  const tx = animal.femaleDetails?.health?.treatments?.length || 0;
  return `${animal.femaleCategory || "Heifer"} · Parity ${parity} · PD ${pd} · Calf entry ${calfCreated} · Treatments ${tx}`;
}

const newBodyWeight = () => ({ date: "", weight: "" });
const newDeworming = () => ({ date: "", drug: "" });
const newVaccination = () => ({ date: "", vaccine: "" });
const newTreatment = () => ({ date: "", diagnosis: "", treatment: "" });
const newMaleAIEntry = () => ({ date: "", aiDoneOn: "", result: "Pending" });

export default function App() {
  const [animals, setAnimals] = useState(() => loadAnimals().map(withDefaults));
  const [form, setForm] = useState({ ...EMPTY });
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState("");
  const [femaleTab, setFemaleTab] = useState("Pedigree");
  const [maleTab, setMaleTab] = useState("Pedigree");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(animals));
  }, [animals]);

  const selected = useMemo(() => animals.find(a => a.id === selectedId) || null, [animals, selectedId]);
  const currentAnimals = animals.filter(a => !isArchived(a));
  const archivedAnimals = animals.filter(a => isArchived(a));

  function addAnimal() {
    if (!form.tag.trim()) return setMsg("Tag No is required.");
    const nextAnimal = normalizeAnimal({ id: Date.now(), ...form });
    setAnimals([...animals, nextAnimal]);
    setSelectedId(nextAnimal.id);
    setFemaleTab("Pedigree");
    setMaleTab("Pedigree");
    setForm({ ...EMPTY });
    setMsg("Animal added.");
  }

  function openEdit(animal) {
    setSelectedId(animal.id);
    setEditForm(normalizeAnimal({
      tag: animal.tag || "",
      sex: animal.sex || "Female",
      dob: animal.dob || "",
      status: animal.status || "Active",
      exitDate: animal.exitDate || "",
      exitReason: animal.exitReason || "",
      femaleCategory: animal.femaleCategory || "Heifer",
      femaleDetails: animal.femaleDetails || EMPTY_FEMALE_DETAILS,
      maleDetails: animal.maleDetails || EMPTY_MALE_DETAILS,
      id: animal.id,
    }));
    setEditing(true);
    setMsg("");
  }

  function saveEdit() {
    if (!editForm.tag.trim()) return setMsg("Tag No is required.");
    setAnimals(animals.map(a => a.id === selectedId ? normalizeAnimal({ ...a, ...editForm }) : a));
    setEditing(false);
    setMsg("Animal updated.");
  }

  function deleteAnimal() {
    if (!selected) return;
    if (!window.confirm(`Delete animal ${selected.tag}?`)) return;
    setAnimals(animals.filter(a => a.id !== selected.id));
    setSelectedId(null);
    setEditing(false);
    setMsg("Animal deleted.");
  }

  function clearData() {
    if (!window.confirm("Clear all browser-saved data?")) return;
    setAnimals([]);
    setSelectedId(null);
    setEditing(false);
    setForm({ ...EMPTY });
    setEditForm({ ...EMPTY });
    setFemaleTab("Pedigree");
    setMaleTab("Pedigree");
    setMsg("All browser data cleared.");
  }

  function updateSelectedFemaleDetails(section, key, value) {
    if (!selected || selected.sex !== "Female") return;
    setAnimals(animals.map(a => {
      if (a.id !== selected.id) return a;
      const updated = normalizeAnimal({
        ...a,
        femaleDetails: { ...a.femaleDetails, [section]: { ...a.femaleDetails?.[section], [key]: value } },
      });
      if (section === "reproduction") updated.femaleDetails.calving.calfSire = buildCalfSire(updated.femaleDetails.reproduction);
      return updated;
    }));
  }

  function updateSelectedMaleDetails(section, key, value) {
    if (!selected || selected.sex !== "Male") return;
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      maleDetails: { ...a.maleDetails, [section]: { ...a.maleDetails?.[section], [key]: value } },
    }) : a));
  }

  function updateSelectedMaleRoot(key, value) {
    if (!selected || selected.sex !== "Male") return;
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      maleDetails: { ...a.maleDetails, [key]: value },
    }) : a));
  }

  function addMaleAIRow() {
    if (!selected || selected.sex !== "Male") return;
    const list = selected.maleDetails?.aiInformation || [];
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      maleDetails: { ...a.maleDetails, aiInformation: [...list, newMaleAIEntry()] },
    }) : a));
  }

  function updateMaleAIRow(index, key, value) {
    if (!selected || selected.sex !== "Male") return;
    const list = selected.maleDetails?.aiInformation || [];
    const nextList = list.map((row, i) => i === index ? { ...row, [key]: value } : row);
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      maleDetails: { ...a.maleDetails, aiInformation: nextList },
    }) : a));
  }

  function removeMaleAIRow(index) {
    if (!selected || selected.sex !== "Male") return;
    const list = selected.maleDetails?.aiInformation || [];
    const nextList = list.filter((_, i) => i !== index);
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      maleDetails: { ...a.maleDetails, aiInformation: nextList },
    }) : a));
  }

  function updateSelectedFemaleCategory(value) {
    if (!selected || selected.sex !== "Female") return;
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({ ...a, femaleCategory: value }) : a));
  }

  function updateSelectedReproduction(key, value) {
    if (!selected || selected.sex !== "Female") return;
    const current = selected.femaleDetails?.reproduction || {};
    const nextRepro = { ...current, [key]: value };
    if (key === "conceptionDate") nextRepro.expectedCalvingDate = addDaysToDateString(value, 310);
    setAnimals(animals.map(a => {
      if (a.id !== selected.id) return a;
      const updated = normalizeAnimal({ ...a, femaleDetails: { ...a.femaleDetails, reproduction: nextRepro } });
      updated.femaleDetails.calving.calfSire = buildCalfSire(updated.femaleDetails.reproduction);
      return updated;
    }));
  }

  function updateHealthList(listName, index, key, value) {
    if (!selected || selected.sex !== "Female") return;
    const currentList = selected.femaleDetails?.health?.[listName] || [];
    const nextList = currentList.map((item, i) => i === index ? { ...item, [key]: value } : item);
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      femaleDetails: { ...a.femaleDetails, health: { ...a.femaleDetails.health, [listName]: nextList } }
    }) : a));
  }

  function addHealthRow(listName) {
    if (!selected || selected.sex !== "Female") return;
    const currentList = selected.femaleDetails?.health?.[listName] || [];
    let row = {};
    if (listName === "bodyWeights") row = newBodyWeight();
    if (listName === "dewormings") row = newDeworming();
    if (listName === "vaccinations") row = newVaccination();
    if (listName === "treatments") row = newTreatment();
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      femaleDetails: { ...a.femaleDetails, health: { ...a.femaleDetails.health, [listName]: [...currentList, row] } }
    }) : a));
  }

  function removeHealthRow(listName, index) {
    if (!selected || selected.sex !== "Female") return;
    const currentList = selected.femaleDetails?.health?.[listName] || [];
    const nextList = currentList.filter((_, i) => i !== index);
    setAnimals(animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      femaleDetails: { ...a.femaleDetails, health: { ...a.femaleDetails.health, [listName]: nextList } }
    }) : a));
  }

  function createCalfFromSelectedDam() {
    if (!selected || selected.sex !== "Female") return;
    const calfTag = selected.femaleDetails?.calving?.calfTag || "";
    const calvingDate = selected.femaleDetails?.calving?.calvingDate || "";
    if (!calfTag.trim()) return setMsg("Enter calf tag before creating calf.");
    if (animals.some(a => String(a.tag).trim() === calfTag.trim())) return setMsg("A calf with this tag already exists.");
    const calfSex = selected.femaleDetails?.calving?.calfSex || "Male";
    const calf = normalizeAnimal({
      id: Date.now(),
      tag: calfTag.trim(),
      sex: calfSex,
      dob: calvingDate,
      status: "Active",
      exitDate: "",
      exitReason: "",
      femaleCategory: calfSex === "Female" ? "Heifer" : "",
      femaleDetails: calfSex === "Female" ? {
        pedigree: { dam: selected.tag, sire: selected.femaleDetails?.calving?.calfSire || "" },
        reproduction: { parity: "0", aiDate: "", bullNo: "", setNo: "", pdStatus: "Not checked", conceptionDate: "", expectedCalvingDate: "", notes: "" },
        calving: { calvingDate: "", calfSex: "Male", calfTag: "", calfSire: "", calfCreated: "No", notes: "" },
        health: { bodyWeights: [], dewormings: [], vaccinations: [], treatments: [], notes: "" },
        history: { notes: "" },
      } : undefined,
      maleDetails: calfSex === "Male" ? EMPTY_MALE_DETAILS : undefined,
    });
    const nextAnimals = animals.map(a => a.id === selected.id ? normalizeAnimal({
      ...a,
      femaleCategory: "Milk",
      femaleDetails: { ...a.femaleDetails, calving: { ...a.femaleDetails.calving, calfCreated: "Yes" } }
    }) : a);
    setAnimals([...nextAnimals, calf]);
    setMsg(`Calf ${calfTag} created from dam ${selected.tag}. Dam moved to Milk.`);
  }

  return (
    <div className="container">
      <h1>Buffalo Herd App - Phase 9</h1>
      {msg && <div className="msg">{msg}</div>}

      <div className="grid">
        <div>
          <div className="card">
            <h3>Add Animal</h3>
            <label className="small">Tag No</label>
            <input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} />
            <label className="small">Sex</label>
            <select value={form.sex} onChange={e => setForm({
              ...form,
              sex: e.target.value,
              femaleCategory: e.target.value === "Female" ? "Heifer" : "",
              femaleDetails: e.target.value === "Female" ? EMPTY_FEMALE_DETAILS : undefined,
              maleDetails: e.target.value === "Male" ? EMPTY_MALE_DETAILS : undefined
            })}>
              <option>Female</option><option>Male</option>
            </select>
            {form.sex === "Female" && <>
              <label className="small">Female Category</label>
              <select value={form.femaleCategory} onChange={e => setForm({ ...form, femaleCategory: e.target.value })}>
                {FEMALE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </>}
            <label className="small">Date of Birth</label>
            <input placeholder="dd/mm/yyyy" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
            <label className="small">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Active</option><option>Dead</option><option>Culled</option>
            </select>
            {(form.status === "Dead" || form.status === "Culled") && <>
              <label className="small">Exit Date</label>
              <input placeholder="dd/mm/yyyy" value={form.exitDate} onChange={e => setForm({ ...form, exitDate: e.target.value })} />
              <label className="small">Exit Reason</label>
              <input value={form.exitReason} onChange={e => setForm({ ...form, exitReason: e.target.value })} />
            </>}
            <button onClick={addAnimal}>Add Animal</button>
            <button className="danger" onClick={clearData}>Clear Browser Data</button>
          </div>

          <div className="card">
            <h3>Current Herd</h3>
            {currentAnimals.length === 0 && <p>No current animals.</p>}
            {currentAnimals.map(a => <button className="listbtn" key={a.id} onClick={() => { setSelectedId(a.id); setFemaleTab("Pedigree"); setMaleTab("Pedigree"); }}>
              {a.tag} ({a.sex}){a.sex === "Female" ? ` - ${a.femaleCategory}` : ""} - {a.status}
            </button>)}
          </div>

          <div className="card">
            <h3>Archive</h3>
            {archivedAnimals.length === 0 && <p>No archived animals.</p>}
            {archivedAnimals.map(a => <button className="listbtn" key={a.id} onClick={() => { setSelectedId(a.id); setFemaleTab("Pedigree"); setMaleTab("Pedigree"); }}>
              {a.tag} ({a.sex}) - {a.status}
            </button>)}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Selected Animal</h3>
            {!selected && <p>No animal selected.</p>}
            {selected && <>
              <p><b>Tag:</b> {selected.tag}</p>
              <p><b>Sex:</b> {selected.sex}</p>
              <p><b>DOB:</b> {selected.dob || "-"}</p>
              <p><b>Status:</b> {selected.status || "Active"}</p>
              <div className="summary"><b>Summary:</b> {getAnimalSummary(selected)}</div>
              {(selected.status === "Dead" || selected.status === "Culled") && <>
                <p><b>Exit Date:</b> {selected.exitDate || "-"}</p>
                <p><b>Exit Reason:</b> {selected.exitReason || "-"}</p>
              </>}
              <button onClick={() => openEdit(selected)}>Edit Animal</button>
            </>}
          </div>

          {selected && selected.sex === "Female" && <div className="card">
            <h3>Female Workflow</h3>
            <label className="small">Current Female Category</label>
            <select value={selected.femaleCategory || "Heifer"} onChange={e => updateSelectedFemaleCategory(e.target.value)}>
              {FEMALE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <div className="tabs">
              {FEMALE_TABS.map(tab => <button key={tab} className={`tabbtn ${femaleTab === tab ? "active" : ""}`} onClick={() => setFemaleTab(tab)}>{tab}</button>)}
            </div>

            {femaleTab === "Pedigree" && <>
              <label className="small">Sire</label>
              <input value={selected.femaleDetails?.pedigree?.sire || ""} onChange={e => updateSelectedFemaleDetails("pedigree", "sire", e.target.value)} />
              <label className="small">Dam</label>
              <input value={selected.femaleDetails?.pedigree?.dam || ""} onChange={e => updateSelectedFemaleDetails("pedigree", "dam", e.target.value)} />
            </>}

            {femaleTab === "Reproduction" && <>
              <label className="small">Current Parity</label>
              <input value={selected.femaleDetails?.reproduction?.parity || ""} onChange={e => updateSelectedReproduction("parity", e.target.value)} />
              <label className="small">AI Date</label>
              <input placeholder="dd/mm/yyyy" value={selected.femaleDetails?.reproduction?.aiDate || ""} onChange={e => updateSelectedReproduction("aiDate", e.target.value)} />
              <label className="small">Bull No</label>
              <input value={selected.femaleDetails?.reproduction?.bullNo || ""} onChange={e => updateSelectedReproduction("bullNo", e.target.value)} />
              <label className="small">Set No</label>
              <input value={selected.femaleDetails?.reproduction?.setNo || ""} onChange={e => updateSelectedReproduction("setNo", e.target.value)} />
              <label className="small">PD Status</label>
              <select value={selected.femaleDetails?.reproduction?.pdStatus || "Not checked"} onChange={e => updateSelectedReproduction("pdStatus", e.target.value)}>
                {PD_OPTIONS.map(x => <option key={x}>{x}</option>)}
              </select>
              <label className="small">Conception Date</label>
              <input placeholder="dd/mm/yyyy" value={selected.femaleDetails?.reproduction?.conceptionDate || ""} onChange={e => updateSelectedReproduction("conceptionDate", e.target.value)} />
              <label className="small">Expected Calving Date</label>
              <input value={selected.femaleDetails?.reproduction?.expectedCalvingDate || ""} readOnly />
              <label className="small">Reproduction Notes</label>
              <textarea rows="5" value={selected.femaleDetails?.reproduction?.notes || ""} onChange={e => updateSelectedReproduction("notes", e.target.value)} />
            </>}

            {femaleTab === "Calving" && <>
              <label className="small">Calving Date</label>
              <input placeholder="dd/mm/yyyy" value={selected.femaleDetails?.calving?.calvingDate || ""} onChange={e => updateSelectedFemaleDetails("calving", "calvingDate", e.target.value)} />
              <label className="small">Calf Sex</label>
              <select value={selected.femaleDetails?.calving?.calfSex || "Male"} onChange={e => updateSelectedFemaleDetails("calving", "calfSex", e.target.value)}>
                {CALF_SEX_OPTIONS.map(x => <option key={x}>{x}</option>)}
              </select>
              <label className="small">Calf Tag</label>
              <input value={selected.femaleDetails?.calving?.calfTag || ""} onChange={e => updateSelectedFemaleDetails("calving", "calfTag", e.target.value)} />
              <label className="small">Calf Sire</label>
              <input value={selected.femaleDetails?.calving?.calfSire || ""} readOnly />
              <label className="small">Calf Created</label>
              <input value={selected.femaleDetails?.calving?.calfCreated || "No"} readOnly />
              <div className="info">Calf sire is picked automatically from Bull No. and Set No. in Reproduction.</div>
              <button onClick={createCalfFromSelectedDam}>Create Calf Entry</button>
              <label className="small">Calving Notes</label>
              <textarea rows="5" value={selected.femaleDetails?.calving?.notes || ""} onChange={e => updateSelectedFemaleDetails("calving", "notes", e.target.value)} />
            </>}

            {femaleTab === "Health" && <>
              <div className="summary"><b>Health Records</b></div>
              <h4>Body Weight</h4>
              {(selected.femaleDetails?.health?.bodyWeights || []).map((row, idx) => <div key={`bw-${idx}`} className="inline-card">
                <label className="small">Recording Date</label>
                <input value={row.date || ""} placeholder="dd/mm/yyyy" onChange={e => updateHealthList("bodyWeights", idx, "date", e.target.value)} />
                <label className="small">Body Weight</label>
                <input value={row.weight || ""} onChange={e => updateHealthList("bodyWeights", idx, "weight", e.target.value)} />
                <button className="danger" onClick={() => removeHealthRow("bodyWeights", idx)}>- Remove</button>
              </div>)}
              <button onClick={() => addHealthRow("bodyWeights")}>+ Add Body Weight</button>

              <h4>Deworming</h4>
              {(selected.femaleDetails?.health?.dewormings || []).map((row, idx) => <div key={`dw-${idx}`} className="inline-card">
                <label className="small">Deworming Date</label>
                <input value={row.date || ""} placeholder="dd/mm/yyyy" onChange={e => updateHealthList("dewormings", idx, "date", e.target.value)} />
                <label className="small">Anthelmintic Used</label>
                <input value={row.drug || ""} onChange={e => updateHealthList("dewormings", idx, "drug", e.target.value)} />
                <button className="danger" onClick={() => removeHealthRow("dewormings", idx)}>- Remove</button>
              </div>)}
              <button onClick={() => addHealthRow("dewormings")}>+ Add Deworming</button>

              <h4>Vaccination</h4>
              {(selected.femaleDetails?.health?.vaccinations || []).map((row, idx) => <div key={`vx-${idx}`} className="inline-card">
                <label className="small">Vaccination Date</label>
                <input value={row.date || ""} placeholder="dd/mm/yyyy" onChange={e => updateHealthList("vaccinations", idx, "date", e.target.value)} />
                <label className="small">Vaccine Used</label>
                <input value={row.vaccine || ""} onChange={e => updateHealthList("vaccinations", idx, "vaccine", e.target.value)} />
                <button className="danger" onClick={() => removeHealthRow("vaccinations", idx)}>- Remove</button>
              </div>)}
              <button onClick={() => addHealthRow("vaccinations")}>+ Add Vaccination</button>

              <h4>Treatment</h4>
              {(selected.femaleDetails?.health?.treatments || []).map((row, idx) => <div key={`tx-${idx}`} className="inline-card">
                <label className="small">Treatment Date</label>
                <input value={row.date || ""} placeholder="dd/mm/yyyy" onChange={e => updateHealthList("treatments", idx, "date", e.target.value)} />
                <label className="small">Diagnosis</label>
                <input value={row.diagnosis || ""} onChange={e => updateHealthList("treatments", idx, "diagnosis", e.target.value)} />
                <label className="small">Treatment Given</label>
                <textarea rows="3" value={row.treatment || ""} onChange={e => updateHealthList("treatments", idx, "treatment", e.target.value)} />
                <button className="danger" onClick={() => removeHealthRow("treatments", idx)}>- Remove</button>
              </div>)}
              <button onClick={() => addHealthRow("treatments")}>+ Add Treatment</button>

              <label className="small">General Health Notes</label>
              <textarea rows="5" value={selected.femaleDetails?.health?.notes || ""} onChange={e => updateSelectedFemaleDetails("health", "notes", e.target.value)} />
            </>}

            {femaleTab === "History" && <>
              <label className="small">History Notes</label>
              <textarea rows="5" value={selected.femaleDetails?.history?.notes || ""} onChange={e => updateSelectedFemaleDetails("history", "notes", e.target.value)} />
            </>}
          </div>}

          {selected && selected.sex === "Male" && <div className="card">
            <h3>Male Workflow</h3>
            <label className="small">Selected for Breeding</label>
            <select value={selected.maleDetails?.selectedForBreeding || "No"} onChange={e => updateSelectedMaleRoot("selectedForBreeding", e.target.value)}>
              <option>No</option><option>Yes</option>
            </select>
            {selected.maleDetails?.selectedForBreeding === "Yes" && <>
              <label className="small">Breeding Set No</label>
              <input value={selected.maleDetails?.breedingSetNo || ""} onChange={e => updateSelectedMaleRoot("breedingSetNo", e.target.value)} />
            </>}
            <div className="tabs">
              {MALE_TABS.map(tab => <button key={tab} className={`tabbtn ${maleTab === tab ? "active" : ""}`} onClick={() => setMaleTab(tab)}>{tab}</button>)}
            </div>
            {maleTab === "Pedigree" && <>
              <label className="small">Sire</label>
              <input value={selected.maleDetails?.pedigree?.sire || ""} onChange={e => updateSelectedMaleDetails("pedigree", "sire", e.target.value)} />
              <label className="small">Dam</label>
              <input value={selected.maleDetails?.pedigree?.dam || ""} onChange={e => updateSelectedMaleDetails("pedigree", "dam", e.target.value)} />
            </>}
            {maleTab === "Disease Testing" && <>
              <label className="small">Disease Testing Notes</label>
              <textarea rows="5" value={selected.maleDetails?.diseaseTesting?.notes || ""} onChange={e => updateSelectedMaleDetails("diseaseTesting", "notes", e.target.value)} />
            </>}
            {maleTab === "AI Information" && <>
              <div className="summary"><b>AI Records</b></div>
              {(selected.maleDetails?.aiInformation || []).map((row, idx) => <div key={`ai-${idx}`} className="inline-card">
                <label className="small">Date of AI</label>
                <input placeholder="dd/mm/yyyy" value={row.date || ""} onChange={e => updateMaleAIRow(idx, "date", e.target.value)} />
                <label className="small">AI Done On</label>
                <input value={row.aiDoneOn || ""} onChange={e => updateMaleAIRow(idx, "aiDoneOn", e.target.value)} />
                <label className="small">Result</label>
                <select value={row.result || "Pending"} onChange={e => updateMaleAIRow(idx, "result", e.target.value)}>
                  {AI_RESULT_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
                <button className="danger" onClick={() => removeMaleAIRow(idx)}>- Remove</button>
              </div>)}
              <button onClick={addMaleAIRow}>+ Add AI Record</button>
            </>}
            {maleTab === "Health" && <>
              <label className="small">Health Notes</label>
              <textarea rows="5" value={selected.maleDetails?.health?.notes || ""} onChange={e => updateSelectedMaleDetails("health", "notes", e.target.value)} />
            </>}
            {maleTab === "History" && <>
              <label className="small">History Notes</label>
              <textarea rows="5" value={selected.maleDetails?.history?.notes || ""} onChange={e => updateSelectedMaleDetails("history", "notes", e.target.value)} />
            </>}
          </div>}

          {editing && <div className="card">
            <h3>Edit Animal</h3>
            <label className="small">Tag No</label>
            <input value={editForm.tag} onChange={e => setEditForm({ ...editForm, tag: e.target.value })} />
            <label className="small">Sex</label>
            <select value={editForm.sex} onChange={e => setEditForm({ ...editForm, sex: e.target.value })}>
              <option>Female</option><option>Male</option>
            </select>
            {editForm.sex === "Female" && <>
              <label className="small">Female Category</label>
              <select value={editForm.femaleCategory || "Heifer"} onChange={e => setEditForm({ ...editForm, femaleCategory: e.target.value })}>
                {FEMALE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </>}
            {editForm.sex === "Male" && <>
              <label className="small">Selected for Breeding</label>
              <select value={editForm.maleDetails?.selectedForBreeding || "No"} onChange={e => setEditForm({ ...editForm, maleDetails: { ...editForm.maleDetails, selectedForBreeding: e.target.value } })}>
                <option>No</option><option>Yes</option>
              </select>
              {editForm.maleDetails?.selectedForBreeding === "Yes" && <>
                <label className="small">Breeding Set No</label>
                <input value={editForm.maleDetails?.breedingSetNo || ""} onChange={e => setEditForm({ ...editForm, maleDetails: { ...editForm.maleDetails, breedingSetNo: e.target.value } })} />
              </>}
            </>}
            <label className="small">Date of Birth</label>
            <input placeholder="dd/mm/yyyy" value={editForm.dob} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} />
            <label className="small">Status</label>
            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
              <option>Active</option><option>Dead</option><option>Culled</option>
            </select>
            {(editForm.status === "Dead" || editForm.status === "Culled") && <>
              <label className="small">Exit Date</label>
              <input placeholder="dd/mm/yyyy" value={editForm.exitDate} onChange={e => setEditForm({ ...editForm, exitDate: e.target.value })} />
              <label className="small">Exit Reason</label>
              <input value={editForm.exitReason} onChange={e => setEditForm({ ...editForm, exitReason: e.target.value })} />
            </>}
            <button onClick={saveEdit}>Save Changes</button>
            <button className="danger" onClick={deleteAnimal}>Delete Animal</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>}
        </div>
      </div>
    </div>
  );
}
