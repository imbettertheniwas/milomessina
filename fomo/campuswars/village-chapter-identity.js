const letters=Object.fromEntries('Alpha Α Beta Β Gamma Γ Delta Δ Epsilon Ε Zeta Ζ Eta Η Theta Θ Iota Ι Kappa Κ Lambda Λ Mu Μ Nu Ν Xi Ξ Omicron Ο Pi Π Rho Ρ Sigma Σ Tau Τ Upsilon Υ Phi Φ Chi Χ Psi Ψ Omega Ω'.split(' ').reduce((pairs,word,i,all)=>i%2?pairs:[...pairs,[word.toLowerCase(),all[i+1]]],[]));
// Resolve from the registered chapter name: Latin initials cannot distinguish
// Phi, Pi and Psi, or Omicron and Omega. Non-Greek organizations keep their name.
export function chapterGreekLetters(chapter){
  const words=chapter.name.trim().split(/\s+/);
  return words.every(word=>letters[word.toLowerCase()])?words.map(word=>letters[word.toLowerCase()]).join(''):chapter.name;
}
