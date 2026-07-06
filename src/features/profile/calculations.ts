export function calculateAge(dateOfBirth: string) {
  const birth = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayThisYear) age--;

  return age;
}

export function calculateBmi(heightCm: number, weightKg: number) {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}
