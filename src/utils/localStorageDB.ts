import { Person } from "@/models/Person";

export class LocalStorageDB {

  #lastId: string = '0';

  constructor() {
    if(localStorage.length !== 0)
      this.#lastId = localStorage.length + ''; 
  }

  set(value: Person): string {
    this.#lastId = +this.#lastId + 1 + '';
    localStorage.setItem(this.#lastId, JSON.stringify(value));
    return this.#lastId;
  }

  get(key: string): Person | null {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as Person;
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }
}