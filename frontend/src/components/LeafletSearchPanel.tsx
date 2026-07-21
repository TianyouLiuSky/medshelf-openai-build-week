import { useI18n } from "../i18n";
import type { Medication } from "../types/medicine";

interface LeafletSearchPanelProps {
  medication: Medication;
}

interface LeafletSearchLink {
  label: string;
  url: string;
}

interface LeafletSearchFields {
  approvalNumber: string;
  manufacturer: string;
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value.replace(/\s+/g, " ").trim());
}

function detectApprovalNumber(text: string): string {
  const compactText = text.replace(/\s+/g, "");
  const domesticMatch = compactText.match(/国药(?:准|试)字[A-Z]\d{8}/i);
  if (domesticMatch) {
    return domesticMatch[0].toUpperCase();
  }

  const importedMatch = text.match(
    /(?:进口药品注册证号|医药产品注册证号)\s*[：:]?\s*([A-Za-z0-9-]+)/i
  );
  return importedMatch?.[1]?.trim() ?? "";
}

function detectManufacturer(text: string): string {
  const match = text.match(
    /(?:上市许可持有人|药品上市许可持有人|生产企业|生产厂商|厂家|制造商)\s*[：:]\s*([^\n,，;；。]+)/i
  );
  return match?.[1]?.trim() ?? "";
}

function detectSearchFields(medication: Medication): LeafletSearchFields {
  const searchText = [
    medication.name,
    medication.active_ingredients,
    medication.form,
    medication.strength,
    medication.notes
  ].join("\n");

  return {
    approvalNumber: detectApprovalNumber(searchText),
    manufacturer: detectManufacturer(searchText)
  };
}

function buildSearchLinks(medication: Medication): {
  fields: LeafletSearchFields;
  links: LeafletSearchLink[];
} {
  const fields = detectSearchFields(medication);
  const baseQuery = [
    medication.name,
    fields.approvalNumber,
    fields.manufacturer,
    "药品说明书"
  ]
    .filter(Boolean)
    .join(" ");

  const links: LeafletSearchLink[] = [
    {
      label: "Google search",
      url: `https://www.google.com/search?q=${encodeQuery(baseQuery)}`
    }
  ];

  return { fields, links };
}

function LeafletSearchPanel({ medication }: LeafletSearchPanelProps) {
  const { t } = useI18n();
  const { fields, links } = buildSearchLinks(medication);

  return (
    <div className="leaflet-search-panel">
      <div>
        <h3>{t("Find leaflet online")}</h3>
        <p>
          {t(
            "Use online leaflet results only as a reference copy. Confirm the original package, clinician, or pharmacist directions before changing any plan."
          )}
        </p>
      </div>

      <div className="leaflet-search-links">
        {links.map((link) => (
          <a
            className="restock-link"
            href={link.url}
            key={link.label}
            rel="noreferrer"
            target="_blank"
          >
            {t(link.label)}
          </a>
        ))}
      </div>

      {(fields.approvalNumber || fields.manufacturer) && (
        <p className="leaflet-search-detected">
          {fields.approvalNumber &&
            `${t("Detected approval number")}: ${fields.approvalNumber}`}
          {fields.approvalNumber && fields.manufacturer ? " · " : ""}
          {fields.manufacturer &&
            `${t("Detected manufacturer")}: ${fields.manufacturer}`}
        </p>
      )}
      {!fields.approvalNumber && !fields.manufacturer && (
        <p className="leaflet-search-detected">
          {t(
            "Add an approval number or manufacturer to medicine notes to make search links more precise."
          )}
        </p>
      )}
    </div>
  );
}

export default LeafletSearchPanel;
