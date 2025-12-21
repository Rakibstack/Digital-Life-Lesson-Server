import fs from 'fs';
const key = fs.readFileSync('./degital-life-lesson.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)