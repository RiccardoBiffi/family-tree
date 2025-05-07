import { Person } from "@/models/Person";

// utils/localStorageDB.ts
export class LocalStorageDB {
  constructor(private dbName: string) {}

  set(key: string, value: Person): void {
    const db = this.getDB();
    db[key] = value;
    localStorage.setItem(this.dbName, JSON.stringify(db));
  }

  get(key: string): Person | null {
    const db = this.getDB();
    return db[key] || null;
  }

  remove(key: string): void {
    const db = this.getDB();
    delete db[key];
    localStorage.setItem(this.dbName, JSON.stringify(db));
  }

  clear(): void {
    localStorage.removeItem(this.dbName);
  }

  lastId(): number {
    const db = this.getDB();
    const ids = Object.keys(db).map((key) => parseInt(key, 10));
    return ids.length > 0 ? Math.max(...ids) : 0;
  }

  private getDB(): Record<string, Person> {
    const db = localStorage.getItem(this.dbName);
    return db ? JSON.parse(db) : {};
  }
}