const { mkdir, readFile, rename, writeFile } = require('node:fs/promises');
const path = require('node:path');

const EMPTY_STATE = Object.freeze({
  opportunities: {},
  deliveries: {},
  pending: {},
  feedback: [],
});

function freshState() {
  return JSON.parse(JSON.stringify(EMPTY_STATE));
}

class JsonStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      return { ...freshState(), ...parsed };
    } catch (error) {
      if (error.code === 'ENOENT') return freshState();
      throw error;
    }
  }

  async save(state) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}

module.exports = { JsonStore };
