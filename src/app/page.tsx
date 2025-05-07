"use client";
import { Person } from "@/models/Person";
import { LocalStorageDB } from "@/utils/localStorageDB";
import { useEffect, useState } from "react";

export default function Page() {
  const [person, setPerson] = useState({} as Person);

  const ls = new LocalStorageDB();
  useEffect(() => {
    console.log(ls.get("2"));
  }, [ls]);

  const handleSave = () => {
    console.log(ls.set(person));
  };

  return (
    <div>
      <input
        value={person?.name}
        onChange={(e) => {
          const p = new Person(
            e.target.value,
            "Johnny",
            "Doe",
            "Male",
            new Date("1990-01-01"),
            "New York",
            new Date("2070-01-01"),
            "Los Angeles"
          );
          setPerson(p);
        }}
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
