package models

import "time"

// Money is stored as integer minor units. Float columns in the legacy schema are
// retained only for import compatibility; new postings must use amount_minor.
type User struct { ID int64; Username, PasswordHash, Role, Status string; CanManageAccounts, CanViewCashFlow bool }
type Session struct { SID string; UserID int64; Username, Role, IP, UserAgent string; CreatedAt, LastSeenAt time.Time; EndedAt *time.Time }
type Account struct { ID int64; Name, Type, Category, Currency string; BalanceMinor int64; IsActive bool }
type Client struct { ID int64; Code, Name, Phone, Address, Category string; OpeningBalanceMinor int64; IsActive bool }
type Supplier struct { ID int64; Name, Phone, Address string; OpeningBalanceMinor int64; IsActive bool }
type Material struct { ID int64; Code, Name, Unit string; CategoryID int64; UnitPriceMinor int64; IsActive bool }
type CashFlowEntry struct { ID int64; Direction string; AmountMinor int64; AccountID, DestinationAccountID, CategoryID, SourceID int64; Reference, SourceType, Description string; IsVoid bool; Revision int }
type AuditLog struct { ID string; Module, Action, EntityType string; EntityID, UserID int64; Username, Reason string; CreatedAt time.Time }
