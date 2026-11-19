"""Depreciation maths for the asset register (pure functions, no Django imports).

Two methods are supported:

* **Straight-line** — the depreciable amount is spread evenly over the useful life::

      annual depreciation = (cost - salvage) / useful_life_years

* **Declining balance (double-declining)** — a fixed rate of ``2 / useful_life_years``
  is applied to the *opening* book value of each year::

      depreciation_y = opening_y * (2 / useful_life_years)

  The closing value is never allowed to fall below the salvage value, and in the
  final year of the useful life the remaining amount is written off so that the
  closing book value equals the salvage value exactly.

Current value (book value "as of" a date)
-----------------------------------------
Depreciation years are counted from the asset's ``purchase_date`` (year 1 runs from
the purchase date to the day before its first anniversary). The book value on a
given date is **prorated within the current depreciation year**: we take the
closing value of all completed years from the schedule and then subtract the
fraction of the current year's charge that has elapsed, where::

      elapsed_years = (as_of - purchase_date).days / 365.25

For straight-line this reduces to ``cost - annual * elapsed_years``. Once the useful
life has elapsed the book value stays at salvage. All money is handled as
``Decimal`` and rounded to 2 decimal places (kobo).
"""

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

STRAIGHT_LINE = "straight_line"
DECLINING_BALANCE = "declining_balance"
METHODS = (STRAIGHT_LINE, DECLINING_BALANCE)

DAYS_PER_YEAR = Decimal("365.25")
CENT = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class ScheduleRow:
    period: int  # 1..useful_life_years
    year: int  # calendar year in which this depreciation year starts
    opening: Decimal
    depreciation: Decimal
    closing: Decimal

    def as_dict(self):
        return {
            "year": self.year,
            "period": self.period,
            "opening": float(self.opening),
            "depreciation": float(self.depreciation),
            "closing": float(self.closing),
        }


def schedule(cost, salvage, useful_life_years, method=STRAIGHT_LINE, start_year=1):
    """Return the full depreciation schedule as a list of ``ScheduleRow``.

    ``start_year`` labels the first row (normally the purchase year).
    """
    cost, salvage = _money(cost), _money(salvage)
    life = int(useful_life_years or 0)
    if method not in METHODS:
        raise ValueError(f"Unknown depreciation method: {method!r}")
    if salvage > cost:
        salvage = cost
    if life <= 0:
        return []

    rows = []
    opening = cost
    straight_charge = (cost - salvage) / life
    rate = Decimal(2) / Decimal(life)
    for period in range(1, life + 1):
        if period == life:
            charge = opening - salvage  # last year: drop exactly to salvage
        elif method == STRAIGHT_LINE:
            charge = straight_charge
        else:
            charge = opening * rate
        charge = _money(max(Decimal(0), min(charge, opening - salvage)))
        closing = opening - charge
        rows.append(ScheduleRow(period, start_year + period - 1, opening, charge, closing))
        opening = closing
    return rows


def elapsed_years(purchase_date: date, as_of: date) -> Decimal:
    """Fractional years between purchase and ``as_of`` (never negative)."""
    days = (as_of - purchase_date).days
    return max(Decimal(0), Decimal(days) / DAYS_PER_YEAR)


def book_value(cost, salvage, useful_life_years, method, purchase_date: date, as_of: date) -> Decimal:
    """Book value on ``as_of``, prorated within the current depreciation year."""
    cost = _money(cost)
    if as_of < purchase_date:
        return cost
    rows = schedule(cost, salvage, useful_life_years, method)
    if not rows:
        return cost
    t = elapsed_years(purchase_date, as_of)
    full_years = int(t)
    if full_years >= len(rows):
        return rows[-1].closing
    current = rows[full_years]
    fraction = t - full_years
    return _money(current.opening - current.depreciation * fraction)


def accumulated_depreciation(cost, salvage, useful_life_years, method, purchase_date, as_of) -> Decimal:
    return _money(cost) - book_value(cost, salvage, useful_life_years, method, purchase_date, as_of)
