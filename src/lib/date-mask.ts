function onlyDateDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function isAllowedDayMonthDigits(digits: string) {
  if (!digits) return true;

  if (digits.length === 1) {
    return /^[0-3]$/.test(digits);
  }

  const day = Number(digits.slice(0, 2));

  if (day < 1 || day > 31) {
    return false;
  }

  if (digits.length === 2) {
    return true;
  }

  const monthDigits = digits.slice(2);

  if (monthDigits.length === 1) {
    return /^[0-1]$/.test(monthDigits);
  }

  const month = Number(monthDigits.slice(0, 2));

  return month >= 1 && month <= 12;
}

function formatDayMonthDigits(digits: string) {
  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const monthNames = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

export function formatDateInput(value: string) {
  const digits = onlyDateDigits(value);
  let acceptedDigits = "";

  for (const digit of digits) {
    const candidate = `${acceptedDigits}${digit}`;

    if (!isAllowedDayMonthDigits(candidate)) {
      break;
    }

    acceptedDigits = candidate;
  }

  return formatDayMonthDigits(acceptedDigits);
}

export function normalizeDayMonth(value: string) {
  return formatDateInput(value);
}

export function formatDayMonthInput(value: string) {
  return formatDateInput(value);
}

export function isValidDayMonth(value: string) {
  if (!/^\d{2}\/\d{2}$/.test(value)) return false;

  const [dayText, monthText] = value.split("/");
  const day = Number(dayText);
  const month = Number(monthText);

  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

export function getDayMonthInputError(value: string) {
  if (!/^\d{2}\/\d{2}$/.test(value)) {
    return "Informe uma data valida no formato DD/MM.";
  }

  const [dayText, monthText] = value.split("/");
  const day = Number(dayText);
  const month = Number(monthText);

  if (day < 1 || day > 31) {
    return "O dia deve estar entre 01 e 31.";
  }

  if (month < 1 || month > 12) {
    return "O mes deve estar entre 01 e 12.";
  }

  return "";
}

export function dateForSlug(value: string) {
  return formatDateInput(value).replace("/", "-");
}

export function dateWithDots(value: string) {
  return isValidDayMonth(value) ? value.replace("/", ".") : "--.--";
}

export function getMonthNameFromDayMonth(value: string) {
  if (!isValidDayMonth(value)) return "";

  const month = Number(value.split("/")[1]);

  return monthNames[month - 1] || "";
}
