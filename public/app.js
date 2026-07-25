import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const els = {
  authView: document.querySelector("#authView"),
  workspaceView: document.querySelector("#workspaceView"),
  email: document.querySelector("#emailInput"),
  password: document.querySelector("#passwordInput"),
  login: document.querySelector("#loginButton"),
  signup: document.querySelector("#signupButton"),
  googleLogin: document.querySelector("#googleLoginButton"),
  logout: document.querySelector("#logoutButton"),
  accountLabel: document.querySelector("#accountLabel"),
  restaurantSelect: document.querySelector("#restaurantSelect"),
  addRestaurant: document.querySelector("#addRestaurantButton"),
  selectedRestaurantLabel: document.querySelector("#selectedRestaurantLabel"),
  weekTitle: document.querySelector("#weekTitle"),
  weekInput: document.querySelector("#weekInput"),
  previousWeek: document.querySelector("#previousWeekButton"),
  nextWeek: document.querySelector("#nextWeekButton"),
  copyWeekTarget: document.querySelector("#copyWeekTarget"),
  copyWeek: document.querySelector("#copyWeekButton"),
  exportWeekPdf: document.querySelector("#exportWeekPdfButton"),
  exportWeekExcel: document.querySelector("#exportWeekExcelButton"),
  exportMonthExcel: document.querySelector("#exportMonthExcelButton"),
  planningBoard: document.querySelector("#planningBoard"),
  restaurantForm: document.querySelector("#restaurantForm"),
  restaurantModal: document.querySelector("#restaurantModal"),
  restaurantModalTitle: document.querySelector("#restaurantModalTitle"),
  restaurantId: document.querySelector("#restaurantIdInput"),
  restaurantName: document.querySelector("#restaurantNameInput"),
  closeRestaurantModal: document.querySelector("#closeRestaurantModalButton"),
  cancelRestaurantEdit: document.querySelector("#cancelRestaurantEditButton"),
  restaurantCards: document.querySelector("#restaurantCards"),
  employeeForm: document.querySelector("#employeeForm"),
  employeeId: document.querySelector("#employeeIdInput"),
  employeeFirstName: document.querySelector("#employeeFirstNameInput"),
  employeeLastName: document.querySelector("#employeeLastNameInput"),
  employeeRole: document.querySelector("#employeeRoleInput"),
  employeeRestaurant: document.querySelector("#employeeRestaurantInput"),
  employeeContract: document.querySelector("#employeeContractInput"),
  employeeActive: document.querySelector("#employeeActiveInput"),
  cancelEmployeeEdit: document.querySelector("#cancelEmployeeEditButton"),
  employeeCards: document.querySelector("#employeeCards"),
  absenceForm: document.querySelector("#absenceForm"),
  absenceName: document.querySelector("#absenceNameInput"),
  absenceChips: document.querySelector("#absenceChips"),
  contractForm: document.querySelector("#contractForm"),
  contractHours: document.querySelector("#contractHoursInput"),
  contractChips: document.querySelector("#contractChips"),
  cellModal: document.querySelector("#cellModal"),
  cellModalTitle: document.querySelector("#cellModalTitle"),
  cellModalSubtitle: document.querySelector("#cellModalSubtitle"),
  closeCellModal: document.querySelector("#closeCellModalButton"),
  cancelCellModal: document.querySelector("#cancelCellModalButton"),
  clearCell: document.querySelector("#clearCellButton"),
  saveCell: document.querySelector("#saveCellButton"),
  modalStatus: document.querySelector("#modalStatusInput"),
  modalLunchStart: document.querySelector("#modalLunchStartInput"),
  modalLunchEnd: document.querySelector("#modalLunchEndInput"),
  modalDinnerStart: document.querySelector("#modalDinnerStartInput"),
  modalDinnerEnd: document.querySelector("#modalDinnerEndInput")
};

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const defaultSettings = {
  absenceTypes: ["Repos", "Conge", "Arret maladie"],
  contracts: [20, 35, 39]
};

let currentUser = null;
let selectedRestaurantId = "";
let visibleWeekStart = startOfWeek(new Date());
let restaurants = [];
let employees = [];
let settings = { ...defaultSettings };
let planEntries = {};
let unsubscribeRestaurants = null;
let unsubscribeEmployees = null;
let unsubscribeSettings = null;
let unsubscribePlan = null;
let saveTimers = new Map();
let editingCell = null;

function assertFirebaseConfigured() {
  if (firebaseConfig.projectId.startsWith("REMPLACEZ")) {
    throw new Error("Configurez public/firebase-config.js avec les valeurs de votre projet Firebase.");
  }
}

function ownerPath(...parts) {
  return ["owners", currentUser.uid, ...parts];
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function weekId(date = visibleWeekStart) {
  return isoDate(startOfWeek(date));
}

function weekInputValue(date) {
  const start = startOfWeek(date);
  const yearStart = startOfWeek(new Date(start.getFullYear(), 0, 4));
  const diffDays = Math.round((start - yearStart) / 86400000);
  const week = String(Math.floor(diffDays / 7) + 1).padStart(2, "0");
  return `${start.getFullYear()}-W${week}`;
}

function dateFromWeekInput(value) {
  const [yearText, weekText] = value.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);
  const firstWeek = startOfWeek(new Date(year, 0, 4));
  return addDays(firstWeek, (week - 1) * 7);
}

function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

function formatHours(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("fr-FR")} h`;
}

function formatTimeRange(start, end) {
  if (!start || !end) return "";
  return `${start}-${end}`;
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal < startTotal) endTotal += 24 * 60;
  return Math.max(0, endTotal - startTotal);
}

function dayHours(day) {
  if (!day || day.status) return 0;
  return (
    minutesBetween(day.lunchStart, day.lunchEnd) +
    minutesBetween(day.dinnerStart, day.dinnerEnd)
  ) / 60;
}

function employeeName(employee) {
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || "Salarie";
}

function selectedRestaurant() {
  return restaurants.find(item => item.id === selectedRestaurantId) || null;
}

function activeEmployeesForRestaurant() {
  return employees
    .filter(employee => employee.active !== false)
    .filter(employee => employee.assignments?.[selectedRestaurantId]?.active !== false)
    .filter(employee => employee.assignments?.[selectedRestaurantId])
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
}

function contractHours(employee) {
  return Number(employee.assignments?.[selectedRestaurantId]?.contractHours || 35);
}

function planDocRef(date = visibleWeekStart) {
  return doc(db, ...ownerPath("plans", `${selectedRestaurantId}_${weekId(date)}`));
}

function setSignedInState(isSignedIn) {
  els.authView.classList.toggle("hidden", isSignedIn);
  els.workspaceView.classList.toggle("hidden", !isSignedIn);
}

function cleanupSubscriptions() {
  if (unsubscribeRestaurants) unsubscribeRestaurants();
  if (unsubscribeEmployees) unsubscribeEmployees();
  if (unsubscribeSettings) unsubscribeSettings();
  if (unsubscribePlan) unsubscribePlan();
  unsubscribeRestaurants = null;
  unsubscribeEmployees = null;
  unsubscribeSettings = null;
  unsubscribePlan = null;
}

async function ensureDefaults() {
  const settingsRef = doc(db, ...ownerPath("settings", "default"));
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, {
      ...defaultSettings,
      updatedAt: serverTimestamp()
    });
  }

  const restaurantsSnap = await getDocs(collection(db, ...ownerPath("restaurants")));
  let primaryRestaurantId = restaurantsSnap.docs[0]?.id || "";
  if (restaurantsSnap.empty) {
    const legacyRestaurant = await getDoc(doc(db, "restaurants", currentUser.uid));
    const created = await addDoc(collection(db, ...ownerPath("restaurants")), {
      name: legacyRestaurant.data()?.name || "Mon restaurant",
      active: true,
      createdAt: serverTimestamp()
    });
    primaryRestaurantId = created.id;
  }

  if (!selectedRestaurantId) {
    selectedRestaurantId = primaryRestaurantId;
    localStorage.setItem("selectedRestaurantId", selectedRestaurantId);
  }

  await migrateLegacyData(primaryRestaurantId || selectedRestaurantId);
}

async function migrateLegacyData(primaryRestaurantId) {
  if (!primaryRestaurantId) return;

  const currentEmployees = await getDocs(collection(db, ...ownerPath("employees")));
  if (!currentEmployees.empty) return;

  const legacyEmployees = await getDocs(collection(db, "restaurants", currentUser.uid, "employees"));
  if (legacyEmployees.empty) return;

  const employeeIdMap = {};
  for (const legacyDoc of legacyEmployees.docs) {
    const legacy = legacyDoc.data();
    const nameParts = String(legacy.name || "").trim().split(" ");
    const created = await addDoc(collection(db, ...ownerPath("employees")), {
      firstName: nameParts.shift() || legacy.name || "Salarie",
      lastName: nameParts.join(" "),
      role: legacy.role || "",
      active: true,
      assignments: {
        [primaryRestaurantId]: {
          active: true,
          contractHours: 35
        }
      },
      migratedFrom: legacyDoc.id,
      createdAt: serverTimestamp()
    });
    employeeIdMap[legacyDoc.id] = created.id;
  }

  const legacyShifts = await getDocs(collection(db, "restaurants", currentUser.uid, "shifts"));
  const plans = {};
  legacyShifts.docs.forEach(legacyDoc => {
    const shift = legacyDoc.data();
    const employeeId = employeeIdMap[shift.employeeId];
    if (!employeeId || !shift.date) return;

    const shiftDate = parseLocalDate(shift.date);
    const planKey = isoDate(startOfWeek(shiftDate));
    const service = Number((shift.start || "00:00").slice(0, 2)) < 17 ? "lunch" : "dinner";

    plans[planKey] ||= {};
    plans[planKey][employeeId] ||= { days: {} };
    plans[planKey][employeeId].days[shift.date] ||= {};
    plans[planKey][employeeId].days[shift.date][`${service}Start`] = shift.start || "";
    plans[planKey][employeeId].days[shift.date][`${service}End`] = shift.end || "";
  });

  for (const [planKey, entries] of Object.entries(plans)) {
    await setDoc(doc(db, ...ownerPath("plans", `${primaryRestaurantId}_${planKey}`)), {
      restaurantId: primaryRestaurantId,
      weekStart: planKey,
      entries,
      migratedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

function subscribeData() {
  unsubscribeRestaurants = onSnapshot(
    query(collection(db, ...ownerPath("restaurants")), orderBy("name")),
    snapshot => {
      restaurants = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      if (!selectedRestaurantId || !restaurants.some(item => item.id === selectedRestaurantId)) {
        selectedRestaurantId = localStorage.getItem("selectedRestaurantId") || restaurants[0]?.id || "";
      }
      if (selectedRestaurantId) localStorage.setItem("selectedRestaurantId", selectedRestaurantId);
      renderRestaurants();
      renderRestaurantOptions();
      subscribePlan();
      renderAll();
    },
    error => alert(error.message)
  );

  unsubscribeEmployees = onSnapshot(
    query(collection(db, ...ownerPath("employees")), orderBy("firstName")),
    snapshot => {
      employees = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderAll();
    },
    error => alert(error.message)
  );

  unsubscribeSettings = onSnapshot(
    doc(db, ...ownerPath("settings", "default")),
    snapshot => {
      settings = { ...defaultSettings, ...(snapshot.data() || {}) };
      settings.contracts = [...new Set(settings.contracts.map(Number))].sort((a, b) => a - b);
      settings.absenceTypes = [...new Set(settings.absenceTypes)];
      renderSettings();
      renderContractOptions();
      renderPlanning();
    },
    error => alert(error.message)
  );
}

function subscribePlan() {
  if (!selectedRestaurantId || !currentUser) return;
  if (unsubscribePlan) unsubscribePlan();

  unsubscribePlan = onSnapshot(
    planDocRef(),
    snapshot => {
      planEntries = snapshot.data()?.entries || {};
      renderPlanning();
    },
    error => alert(error.message)
  );
}

function renderAll() {
  renderRestaurantOptions();
  renderRestaurants();
  renderEmployees();
  renderPlanningHeader();
  renderPlanning();
}

function renderRestaurantOptions() {
  els.restaurantSelect.replaceChildren();
  els.employeeRestaurant.replaceChildren();

  restaurants.forEach(restaurant => {
    const option = new Option(restaurant.name, restaurant.id);
    const employeeOption = new Option(restaurant.name, restaurant.id);
    els.restaurantSelect.append(option);
    els.employeeRestaurant.append(employeeOption);
  });

  els.restaurantSelect.value = selectedRestaurantId;
  els.employeeRestaurant.value = selectedRestaurantId;
  els.employeeRestaurant.disabled = true;
  const restaurant = selectedRestaurant();
  els.selectedRestaurantLabel.textContent = restaurant?.name || "Aucun restaurant";
  els.accountLabel.textContent = currentUser?.email || "Planning equipe";
}

function renderPlanningHeader() {
  const end = addDays(visibleWeekStart, 6);
  els.weekInput.value = weekInputValue(visibleWeekStart);
  els.copyWeekTarget.value = weekInputValue(addDays(visibleWeekStart, 7));
  els.weekTitle.textContent = `Semaine du ${formatDate(visibleWeekStart, { day: "2-digit", month: "long" })} au ${formatDate(end, { day: "2-digit", month: "long", year: "numeric" })}`;
}

function renderPlanning() {
  renderPlanningHeader();
  els.planningBoard.replaceChildren();

  const activeEmployees = activeEmployeesForRestaurant();
  if (!selectedRestaurantId) {
    els.planningBoard.innerHTML = `<div class="panel">Creez ou selectionnez un restaurant.</div>`;
    return;
  }
  if (activeEmployees.length === 0) {
    els.planningBoard.innerHTML = `<div class="panel">Ajoutez des salaries actifs affectes a ce restaurant.</div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "planning-grid";
  const weekTotal = activeEmployees.reduce((sum, employee) => sum + employeeWeekHours(employee), 0);
  grid.append(headerCell(`Salarie\n${activeEmployees.length} pers. - ${formatHours(weekTotal)}`, "employee-col"));
  weekdays.forEach((label, index) => {
    const date = addDays(visibleWeekStart, index);
    grid.append(headerCell(dayHeaderText(label, date, activeEmployees)));
  });

  activeEmployees.forEach(employee => {
    const employeeCell = document.createElement("div");
    const total = employeeWeekHours(employee);
    const expected = contractHours(employee);
    const diff = total - expected;
    const state = Math.abs(diff) <= 0.25 ? "ok" : diff < 0 ? "low" : "high";
    employeeCell.className = "employee-cell";
    employeeCell.innerHTML = `
      <strong>${employeeName(employee)}</strong>
      <small>${employee.role || ""}</small>
      <span class="employee-total">
        <span class="hours-badge ${state}">${formatHours(total)}</span>
        <small>${diff >= 0 ? "+" : ""}${formatHours(diff)} / ${expected} h</small>
      </span>
    `;
    grid.append(employeeCell);

    weekdays.forEach((_, index) => {
      const date = isoDate(addDays(visibleWeekStart, index));
      grid.append(renderWorkCell(employee, date));
    });

  });

  els.planningBoard.append(grid);
}

function headerCell(text, extraClass = "") {
  const cell = document.createElement("div");
  cell.className = `grid-head ${extraClass}`;
  const [title, meta] = text.split("\n");
  cell.innerHTML = `<strong>${title}</strong>${meta ? `<small>${meta}</small>` : ""}`;
  return cell;
}

function dayHeaderText(label, date, activeEmployees) {
  const iso = isoDate(date);
  const present = activeEmployees.filter(employee => dayHours(planEntries[employee.id]?.days?.[iso]) > 0).length;
  const absent = activeEmployees.filter(employee => planEntries[employee.id]?.days?.[iso]?.status).length;
  const hours = activeEmployees.reduce((sum, employee) => sum + dayHours(planEntries[employee.id]?.days?.[iso]), 0);
  return `${label} ${formatDate(date, { day: "2-digit", month: "2-digit" })}\n${present} presents - ${absent} abs. - ${formatHours(hours)}`;
}

function renderWorkCell(employee, date) {
  const entry = planEntries[employee.id]?.days?.[date] || {};
  const cell = document.createElement("div");
  cell.className = "day-work-cell";
  if (entry.status) cell.classList.add("absent");
  cell.append(renderCellDisplay(entry));
  cell.addEventListener("click", () => openCellModal(employee.id, date));
  return cell;
}

function renderCellDisplay(entry) {
  const display = document.createElement("button");
  const lunch = formatTimeRange(entry.lunchStart, entry.lunchEnd);
  const dinner = formatTimeRange(entry.dinnerStart, entry.dinnerEnd);
  const lines = [];

  display.type = "button";
  display.className = "cell-display";
  if (entry.status) {
    display.classList.add("status-display");
    display.textContent = entry.status;
    return display;
  }
  if (lunch) lines.push(lunch);
  if (dinner) lines.push(dinner);
  display.innerHTML = lines.length ? lines.map(line => `<span>${line}</span>`).join("") : `<span class="empty-cell">+</span>`;
  return display;
}

function employeeWeekHours(employee) {
  return weekdays.reduce((sum, _, index) => {
    const date = isoDate(addDays(visibleWeekStart, index));
    return sum + dayHours(planEntries[employee.id]?.days?.[date]);
  }, 0);
}

function openCellModal(employeeId, date) {
  const employee = employees.find(item => item.id === employeeId);
  const entry = planEntries[employeeId]?.days?.[date] || {};
  editingCell = { employeeId, date };
  els.cellModalTitle.textContent = employeeName(employee || {});
  els.cellModalSubtitle.textContent = formatDate(parseLocalDate(date), {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
  els.modalStatus.innerHTML = `<option value="">Travail</option>${settings.absenceTypes.map(type => `<option value="${type}">${type}</option>`).join("")}`;
  els.modalStatus.value = entry.status || "";
  els.modalLunchStart.value = entry.lunchStart || "";
  els.modalLunchEnd.value = entry.lunchEnd || "";
  els.modalDinnerStart.value = entry.dinnerStart || "";
  els.modalDinnerEnd.value = entry.dinnerEnd || "";
  toggleModalTimeInputs();
  els.cellModal.classList.remove("hidden");
}

function closeCellModal() {
  editingCell = null;
  els.cellModal.classList.add("hidden");
}

function toggleModalTimeInputs() {
  const disabled = Boolean(els.modalStatus.value);
  [els.modalLunchStart, els.modalLunchEnd, els.modalDinnerStart, els.modalDinnerEnd].forEach(input => {
    input.disabled = disabled;
    if (disabled) input.value = "";
  });
}

function saveCellModal() {
  if (!editingCell) return;
  updateCell(editingCell.employeeId, editingCell.date, {
    status: els.modalStatus.value,
    lunchStart: els.modalLunchStart.value,
    lunchEnd: els.modalLunchEnd.value,
    dinnerStart: els.modalDinnerStart.value,
    dinnerEnd: els.modalDinnerEnd.value
  });
  closeCellModal();
}

function clearCellModal() {
  if (!editingCell) return;
  updateCell(editingCell.employeeId, editingCell.date, {
    status: "",
    lunchStart: "",
    lunchEnd: "",
    dinnerStart: "",
    dinnerEnd: ""
  });
  closeCellModal();
}

function queuePlanSave() {
  const key = `${selectedRestaurantId}_${weekId()}`;
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(() => saveCurrentPlan(), 350));
}

function updateCell(employeeId, date, patch) {
  const previous = planEntries[employeeId]?.days?.[date] || {};
  const next = { ...previous, ...patch };
  if (next.status) {
    next.lunchStart = "";
    next.lunchEnd = "";
    next.dinnerStart = "";
    next.dinnerEnd = "";
  }
  planEntries = {
    ...planEntries,
    [employeeId]: {
      ...(planEntries[employeeId] || {}),
      days: {
        ...(planEntries[employeeId]?.days || {}),
        [date]: next
      }
    }
  };
  renderPlanning();
  queuePlanSave();
}

async function saveCurrentPlan() {
  if (!currentUser || !selectedRestaurantId) return;
  await setDoc(planDocRef(), {
    restaurantId: selectedRestaurantId,
    weekStart: weekId(),
    entries: planEntries,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function renderEmployees() {
  els.employeeCards.replaceChildren();
  const selected = selectedRestaurant();
  const assignedEmployees = employees
    .filter(employee => employee.assignments?.[selectedRestaurantId])
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));

  assignedEmployees.forEach(employee => {
    const assignment = employee.assignments?.[selectedRestaurantId] || {};
    const isActive = employee.active !== false && assignment.active !== false;
    const card = document.createElement("article");
    card.className = "employee-card";
    card.innerHTML = `
      <div class="card-head">
        <div>
          <h3>${employeeName(employee)}</h3>
          <p class="muted">${employee.role || "Poste non renseigne"}</p>
        </div>
        <span class="chip">${isActive ? "Actif" : "Inactif"}</span>
      </div>
      <p>${selected?.name || "Restaurant"} - ${assignment.contractHours || 35} h</p>
      <div class="card-actions">
        <button type="button" class="soft" data-action="edit">Modifier</button>
        <button type="button" class="ghost" data-action="toggle">${isActive ? "Desactiver" : "Reactiver"}</button>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => editEmployee(employee));
    card.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleEmployee(employee));
    els.employeeCards.append(card);
  });
}

function renderContractOptions() {
  els.employeeContract.replaceChildren();
  settings.contracts.forEach(hours => {
    els.employeeContract.append(new Option(`${hours} heures`, hours));
  });
}

function editEmployee(employee) {
  const assignment = employee.assignments?.[selectedRestaurantId] || {};
  els.employeeId.value = employee.id;
  els.employeeFirstName.value = employee.firstName || "";
  els.employeeLastName.value = employee.lastName || "";
  els.employeeRole.value = employee.role || "";
  els.employeeRestaurant.value = selectedRestaurantId;
  els.employeeContract.value = assignment.contractHours || 35;
  els.employeeActive.checked = employee.active !== false && assignment.active !== false;
  showView("teamView");
}

async function saveEmployee(event) {
  event.preventDefault();
  const restaurantId = selectedRestaurantId;
  if (!els.employeeFirstName.value.trim() || !restaurantId) return;
  const existing = employees.find(item => item.id === els.employeeId.value);
  const assignments = { ...(existing?.assignments || {}) };
  assignments[restaurantId] = {
    active: els.employeeActive.checked,
    contractHours: Number(els.employeeContract.value || 35)
  };
  const payload = {
    firstName: els.employeeFirstName.value.trim(),
    lastName: els.employeeLastName.value.trim(),
    role: els.employeeRole.value.trim(),
    active: existing?.active === false && els.employeeActive.checked ? true : existing?.active ?? true,
    assignments,
    updatedAt: serverTimestamp()
  };
  if (els.employeeId.value) {
    await updateDoc(doc(db, ...ownerPath("employees", els.employeeId.value)), payload);
  } else {
    await addDoc(collection(db, ...ownerPath("employees")), { ...payload, createdAt: serverTimestamp() });
  }
  resetEmployeeForm();
}

function resetEmployeeForm() {
  els.employeeForm.reset();
  els.employeeId.value = "";
  els.employeeActive.checked = true;
  els.employeeRestaurant.value = selectedRestaurantId;
  els.employeeContract.value = settings.contracts.includes(35) ? "35" : String(settings.contracts[0] || 35);
}

async function toggleEmployee(employee) {
  const assignment = employee.assignments?.[selectedRestaurantId];
  if (!assignment) return;
  const isActive = employee.active !== false && assignment.active !== false;
  await updateDoc(doc(db, ...ownerPath("employees", employee.id)), {
    active: isActive ? employee.active !== false : true,
    assignments: {
      ...(employee.assignments || {}),
      [selectedRestaurantId]: {
        ...assignment,
        active: !isActive
      }
    },
    updatedAt: serverTimestamp()
  });
}

function renderRestaurants() {
  els.restaurantCards.replaceChildren();
  restaurants.forEach(restaurant => {
    const card = document.createElement("article");
    card.className = "restaurant-card";
    card.innerHTML = `
      <div class="card-head">
        <div>
          <h3>${restaurant.name}</h3>
          <p class="muted">${restaurant.id === selectedRestaurantId ? "Selectionne" : "Etablissement"}</p>
        </div>
      </div>
      <div class="card-actions">
        <button type="button" class="soft" data-action="select">Selectionner</button>
        <button type="button" class="ghost" data-action="edit">Modifier</button>
        <button type="button" class="danger" data-action="delete">Supprimer</button>
      </div>
    `;
    card.querySelector('[data-action="select"]').addEventListener("click", () => selectRestaurant(restaurant.id));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => editRestaurant(restaurant));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRestaurant(restaurant));
    els.restaurantCards.append(card);
  });
}

async function saveRestaurant(event) {
  event.preventDefault();
  const name = els.restaurantName.value.trim();
  if (!name) return;
  if (els.restaurantId.value) {
    await updateDoc(doc(db, ...ownerPath("restaurants", els.restaurantId.value)), { name, updatedAt: serverTimestamp() });
  } else {
    const created = await addDoc(collection(db, ...ownerPath("restaurants")), { name, active: true, createdAt: serverTimestamp() });
    selectRestaurant(created.id);
  }
  resetRestaurantForm();
  closeRestaurantModal();
}

function editRestaurant(restaurant) {
  els.restaurantId.value = restaurant.id;
  els.restaurantName.value = restaurant.name;
  els.restaurantModalTitle.textContent = "Modifier le restaurant";
  openRestaurantModal();
}

function openRestaurantModal() {
  els.restaurantModal.classList.remove("hidden");
  requestAnimationFrame(() => els.restaurantName.focus());
}

function closeRestaurantModal() {
  els.restaurantModal.classList.add("hidden");
  resetRestaurantForm();
}

function startRestaurantCreate() {
  resetRestaurantForm();
  els.restaurantModalTitle.textContent = "Ajouter un restaurant";
  openRestaurantModal();
}

async function deleteRestaurant(restaurant) {
  if (restaurants.length <= 1) {
    alert("Gardez au moins un restaurant.");
    return;
  }
  if (!confirm(`Supprimer ${restaurant.name} ?`)) return;
  await deleteDoc(doc(db, ...ownerPath("restaurants", restaurant.id)));
  if (selectedRestaurantId === restaurant.id) selectRestaurant(restaurants.find(item => item.id !== restaurant.id)?.id || "");
}

function resetRestaurantForm() {
  els.restaurantForm.reset();
  els.restaurantId.value = "";
}

function selectRestaurant(id) {
  selectedRestaurantId = id;
  localStorage.setItem("selectedRestaurantId", id);
  els.restaurantSelect.value = id;
  planEntries = {};
  resetEmployeeForm();
  subscribePlan();
  renderAll();
}

function renderSettings() {
  renderContractOptions();
  renderChipList(els.absenceChips, settings.absenceTypes, removeAbsence);
  renderChipList(els.contractChips, settings.contracts.map(String), removeContract, " h");
}

function renderChipList(container, values, onRemove, suffix = "") {
  container.replaceChildren();
  values.forEach(value => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${value}${suffix} <button type="button" class="danger">X</button>`;
    chip.querySelector("button").addEventListener("click", () => onRemove(value));
    container.append(chip);
  });
}

async function saveSettings(patch) {
  await setDoc(doc(db, ...ownerPath("settings", "default")), {
    ...settings,
    ...patch,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function addAbsence(event) {
  event.preventDefault();
  const value = els.absenceName.value.trim();
  if (!value) return;
  await saveSettings({ absenceTypes: [...new Set([...settings.absenceTypes, value])] });
  els.absenceForm.reset();
}

async function removeAbsence(value) {
  await saveSettings({ absenceTypes: settings.absenceTypes.filter(item => item !== value) });
}

async function addContract(event) {
  event.preventDefault();
  const value = Number(els.contractHours.value);
  if (!value) return;
  await saveSettings({ contracts: [...new Set([...settings.contracts, value])].sort((a, b) => a - b) });
  els.contractForm.reset();
}

async function removeContract(value) {
  const contracts = settings.contracts.filter(item => Number(item) !== Number(value));
  if (contracts.length === 0) {
    alert("Gardez au moins un contrat.");
    return;
  }
  await saveSettings({ contracts });
}

async function copyWeek() {
  if (!els.copyWeekTarget.value) return;
  const targetStart = dateFromWeekInput(els.copyWeekTarget.value);
  const newEntries = {};
  activeEmployeesForRestaurant().forEach(employee => {
    newEntries[employee.id] = { days: {} };
    weekdays.forEach((_, index) => {
      const sourceDate = isoDate(addDays(visibleWeekStart, index));
      const targetDate = isoDate(addDays(targetStart, index));
      newEntries[employee.id].days[targetDate] = { ...(planEntries[employee.id]?.days?.[sourceDate] || {}) };
    });
  });
  await setDoc(planDocRef(targetStart), {
    restaurantId: selectedRestaurantId,
    weekStart: weekId(targetStart),
    entries: newEntries,
    updatedAt: serverTimestamp()
  }, { merge: true });
  visibleWeekStart = targetStart;
  subscribePlan();
}

function exportWeekExcel() {
  const rows = [["Salarie", ...weekdays, "Total"]];
  activeEmployeesForRestaurant().forEach(employee => {
    const row = [employeeName(employee)];
    let total = 0;
    weekdays.forEach((_, index) => {
      const date = isoDate(addDays(visibleWeekStart, index));
      const day = planEntries[employee.id]?.days?.[date] || {};
      total += dayHours(day);
      row.push(formatDayForExport(day));
    });
    row.push(formatHours(total));
    rows.push(row);
  });
  downloadCsv(`planning-semaine-${weekId()}.csv`, rows);
}

async function exportMonthExcel() {
  const monthStart = new Date(visibleWeekStart.getFullYear(), visibleWeekStart.getMonth(), 1);
  const monthEnd = new Date(visibleWeekStart.getFullYear(), visibleWeekStart.getMonth() + 1, 0);
  const monthEntries = await loadMonthEntries(monthStart, monthEnd);
  const activeEmployees = activeEmployeesForRestaurant();
  const totalsByEmployee = Object.fromEntries(activeEmployees.map(employee => [employee.id, 0]));
  const rows = [["Date", "Jour", ...activeEmployees.map(employeeName)]];
  let date = new Date(monthStart);

  while (date <= monthEnd) {
    const iso = isoDate(date);
    const row = [
      iso,
      formatDate(date, { weekday: "long" })
    ];

    activeEmployees.forEach(employee => {
      const day = monthEntries[employee.id]?.days?.[iso] || {};
      const hours = dayHours(day);
      totalsByEmployee[employee.id] += hours;
      row.push(formatDayForExport(day));
    });

    rows.push(row);
    date = addDays(date, 1);
  }

  rows.push(["TOTAL", "", ...activeEmployees.map(employee => formatHours(totalsByEmployee[employee.id]))]);
  downloadCsv(`planning-mois-${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}.csv`, rows);
}

async function loadMonthEntries(monthStart, monthEnd) {
  const result = {};
  const startBoundary = isoDate(startOfWeek(monthStart));
  const endBoundary = isoDate(startOfWeek(monthEnd));
  const snapshot = await getDocs(collection(db, ...ownerPath("plans")));

  snapshot.docs
    .map(item => item.data())
    .filter(plan => plan.restaurantId === selectedRestaurantId)
    .filter(plan => plan.weekStart >= startBoundary && plan.weekStart <= endBoundary)
    .forEach(plan => {
      Object.entries(plan.entries || {}).forEach(([employeeId, entry]) => {
        result[employeeId] = {
          days: {
            ...(result[employeeId]?.days || {}),
            ...(entry.days || {})
          }
        };
      });
    });

  return result;
}

function formatDayForExport(day) {
  if (!day) return "";
  if (day.status) return day.status;
  const parts = [];
  if (day.lunchStart && day.lunchEnd) parts.push(`Midi ${day.lunchStart}-${day.lunchEnd}`);
  if (day.dinnerStart && day.dinnerEnd) parts.push(`Soir ${day.dinnerStart}-${day.dinnerEnd}`);
  return parts.join("\n");
}

function downloadCsv(filename, rows) {
  const content = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function showView(viewId) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === viewId));
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active-view", view.id === viewId));
}

els.login.addEventListener("click", () => {
  assertFirebaseConfigured();
  signInWithEmailAndPassword(auth, els.email.value.trim(), els.password.value).catch(error => alert(error.message));
});
els.signup.addEventListener("click", () => {
  assertFirebaseConfigured();
  createUserWithEmailAndPassword(auth, els.email.value.trim(), els.password.value).catch(error => alert(error.message));
});
els.googleLogin.addEventListener("click", () => {
  assertFirebaseConfigured();
  signInWithPopup(auth, googleProvider).catch(error => alert(error.message));
});
els.logout.addEventListener("click", () => signOut(auth));
els.restaurantSelect.addEventListener("change", event => selectRestaurant(event.target.value));
els.addRestaurant.addEventListener("click", startRestaurantCreate);
els.previousWeek.addEventListener("click", () => {
  visibleWeekStart = addDays(visibleWeekStart, -7);
  subscribePlan();
  renderAll();
});
els.nextWeek.addEventListener("click", () => {
  visibleWeekStart = addDays(visibleWeekStart, 7);
  subscribePlan();
  renderAll();
});
els.weekInput.addEventListener("change", event => {
  visibleWeekStart = dateFromWeekInput(event.target.value);
  subscribePlan();
  renderAll();
});
els.copyWeek.addEventListener("click", () => copyWeek().catch(error => alert(error.message)));
els.exportWeekPdf.addEventListener("click", () => window.print());
els.exportWeekExcel.addEventListener("click", exportWeekExcel);
els.exportMonthExcel.addEventListener("click", () => exportMonthExcel().catch(error => alert(error.message)));
els.employeeForm.addEventListener("submit", event => saveEmployee(event).catch(error => alert(error.message)));
els.cancelEmployeeEdit.addEventListener("click", resetEmployeeForm);
els.restaurantForm.addEventListener("submit", event => saveRestaurant(event).catch(error => alert(error.message)));
els.closeRestaurantModal.addEventListener("click", closeRestaurantModal);
els.cancelRestaurantEdit.addEventListener("click", closeRestaurantModal);
els.restaurantModal.addEventListener("click", event => {
  if (event.target === els.restaurantModal) closeRestaurantModal();
});
els.absenceForm.addEventListener("submit", event => addAbsence(event).catch(error => alert(error.message)));
els.contractForm.addEventListener("submit", event => addContract(event).catch(error => alert(error.message)));
els.modalStatus.addEventListener("change", toggleModalTimeInputs);
els.saveCell.addEventListener("click", saveCellModal);
els.clearCell.addEventListener("click", clearCellModal);
els.closeCellModal.addEventListener("click", closeCellModal);
els.cancelCellModal.addEventListener("click", closeCellModal);
els.cellModal.addEventListener("click", event => {
  if (event.target === els.cellModal) closeCellModal();
});
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !els.cellModal.classList.contains("hidden")) closeCellModal();
  if (event.key === "Escape" && !els.restaurantModal.classList.contains("hidden")) closeRestaurantModal();
});

onAuthStateChanged(auth, async user => {
  cleanupSubscriptions();
  currentUser = user;
  selectedRestaurantId = localStorage.getItem("selectedRestaurantId") || "";
  restaurants = [];
  employees = [];
  planEntries = {};
  setSignedInState(Boolean(user));
  if (!user) return;
  try {
    await ensureDefaults();
    subscribeData();
  } catch (error) {
    alert(error.message);
  }
});
