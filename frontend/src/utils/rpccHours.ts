/**
 * RPCC Operation Hours Utility
 * 
 * Fall Semester Hours:
 * - Monday - Friday: 8 am - 7 pm
 * - Saturday: 11 am - 7 pm
 * - Sunday: 12 pm - 7 pm
 */

export function isWithinRPCCHours(date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = date.getHours();

  // Monday - Friday: 8 am - 7 pm (8:00 - 19:00)
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return hour >= 8 && hour < 19;
  }

  // Saturday: 11 am - 7 pm (11:00 - 19:00)
  if (dayOfWeek === 6) {
    return hour >= 11 && hour < 19;
  }

  // Sunday: 12 pm - 7 pm (12:00 - 19:00)
  if (dayOfWeek === 0) {
    return hour >= 12 && hour < 19;
  }

  return false;
}

export function getRPCCOperationHours(dayOfWeek: number): { start: number; end: number } {
  // Monday - Friday: 8 am - 7 pm
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return { start: 8, end: 19 };
  }
  // Saturday: 11 am - 7 pm
  if (dayOfWeek === 6) {
    return { start: 11, end: 19 };
  }
  // Sunday: 12 pm - 7 pm
  return { start: 12, end: 19 };
}

export function getRPCCHoursString(dayOfWeek: number): string {
  const { start, end } = getRPCCOperationHours(dayOfWeek);
  const startTime = start === 12 ? "12 pm" : start < 12 ? `${start} am` : `${start - 12} pm`;
  const endTime = end === 12 ? "12 pm" : end < 12 ? `${end} am` : `${end - 12} pm`;
  return `${startTime} - ${endTime}`;
}

