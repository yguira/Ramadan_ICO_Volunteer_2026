import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import Modal from "react-modal";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

Modal.setAppElement("#root");

const TASKS = ["Setup / Iftar prep", "Serve (dates/water/food)", "Cleanup", "Kitchen / dishes"];

function formatDateISO(dateObj) {
  const d = new Date(dateObj);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD"
  const [open, setOpen] = useState(false);
  const [signups, setSignups] = useState([]);
  const [adminMode, setAdminMode] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [task, setTask] = useState(TASKS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load admin mode from localStorage
  useEffect(() => {
    const v = localStorage.getItem("adminMode") === "true";
    setAdminMode(v);
  }, []);

  function toggleAdmin() {
    // simple gate: you can replace with a better admin login later
    const code = prompt("Enter admin code:");
    if (!code) return;
    if (code === import.meta.env.VITE_ADMIN_CODE) {
      const next = !adminMode;
      setAdminMode(next);
      localStorage.setItem("adminMode", String(next));
    } else {
      alert("Wrong code.");
    }
  }

  useEffect(() => {
    if (!selectedDate) return;

    const q = query(collection(db, "signups"), where("date", "==", selectedDate));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setSignups(rows);
    });

    return () => unsub();
  }, [selectedDate]);

  const events = useMemo(() => {
    // Show count per day as calendar “events”
    const counts = {};
    for (const s of signups) {
      counts[s.date] = (counts[s.date] || 0) + 1;
    }
    return Object.entries(counts).map(([date, count]) => ({
      title: `${count} volunteer${count === 1 ? "" : "s"}`,
      date,
      allDay: true,
    }));
  }, [signups]);

  function onDateClick(arg) {
    const iso = formatDateISO(arg.date);
    setSelectedDate(iso);
    setOpen(true);
    setError("");
    setName("");
    setPhone("");
    setTask(TASKS[0]);
  }

  async function submit() {
    setError("");
    const nm = name.trim();
    const ph = phone.trim();

    if (nm.length < 2) return setError("Please enter your name.");
    if (ph.length < 7) return setError("Please enter a valid phone number.");

    setSaving(true);
    try {
      await addDoc(collection(db, "signups"), {
        date: selectedDate,
        name: nm,
        phone: ph,
        task,
        createdAt: serverTimestamp(),
      });
      setName("");
      setPhone("");
      setTask(TASKS[0]);
    } catch (e) {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Ramadan Volunteer Calendar</h1>
          <p>Tap a day to sign up for iftar prep & cleanup.</p>
        </div>
        <button className="ghost" onClick={toggleAdmin}>
          Admin
        </button>
      </header>

      <div className="card">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          dateClick={onDateClick}
          height="auto"
          events={events}
        />
      </div>

      <Modal
        isOpen={open}
        onRequestClose={() => setOpen(false)}
        className="modal"
        overlayClassName="overlay"
        contentLabel="Volunteer signups"
      >
        <div className="modalHead">
          <h2>{selectedDate}</h2>
          <button className="ghost" onClick={() => setOpen(false)}>Close</button>
        </div>

        <section className="section">
          <h3>Signed up</h3>
          {signups.length === 0 ? (
            <p className="muted">No one yet — be the first!</p>
          ) : (
            <ul className="list">
              {signups.map((s) => (
                <li key={s.id} className="listItem">
                  <div>
                    <div className="name">{s.name}</div>
                    <div className="muted">{s.task}</div>
                  </div>
                  {adminMode ? (
                    <div className="phone">{s.phone}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <h3>Add your name</h3>
          <div className="form">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First & last name" />
            </label>

            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </label>

            <label>
              Task
              <select value={task} onChange={(e) => setTask(e.target.value)}>
                {TASKS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            {error ? <div className="error">{error}</div> : null}

            <button className="primary" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Sign up"}
            </button>

            <p className="muted tiny">
              Phone number is stored for coordination. Public view shows names only.
            </p>
          </div>
        </section>
      </Modal>
    </div>
  );
}
