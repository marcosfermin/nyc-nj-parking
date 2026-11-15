import { useId } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** REC-2: 2 km by default (PRD-5). */
export const RADIUS_OPTIONS = [1000, 2000, 5000, 10000] as const;
export const DEFAULT_RADIUS = 2000;

/**
 * WEB-13: while a whole county or borough is listed, the radius doesn't apply. The picker stays where it is, greyed out
 * with a note saying why, so the controls don't move when the kind of search changes.
 */
export function RadiusPicker({ value, onChange, disabled = false }: { value: number; onChange: (radius: number) => void; disabled?: boolean }) {
  const intl = useIntl();
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="radius">
      <label htmlFor={id}>
        <FormattedMessage id="search.radius.label" />
      </label>
      <select id={id} value={value} disabled={disabled} aria-describedby={disabled ? noteId : undefined} onChange={(event) => onChange(Number(event.target.value))}>
        {RADIUS_OPTIONS.map((radius) => (
          <option key={radius} value={radius}>
            {intl.formatMessage({ id: 'search.radius.option' }, { km: radius / 1000 })}
          </option>
        ))}
      </select>
      {disabled && (
        <span id={noteId} className="radius__note">
          <FormattedMessage id="search.radius.notForArea" />
        </span>
      )}
    </div>
  );
}
