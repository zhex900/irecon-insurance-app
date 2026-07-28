- what would be useful dashboard. pretty and useful.
  some charts? on load

user story to verify

db design confirmation.

policy header removal

policy - adjustment relationship.
adjustment is only for turn over.

pending, taken and not taken

adjustment 2 [new policy] date, delta, final amount
taken [original]
adjustment 1 [new policy] date
total amount
Final policy sum token + adjustment 1 and 2

renewals

- taken 2026 1 Policy Group REN1
  - taken 2025 2
  - taken 2024 3
  - taken 2024 adjustment 1 turn 10M
  - taken 2024 adjustment 2 15M
  - taken 2024 adjustment 3 5M [latest policy in 2024]
  - taken 2023 4

Policy Table

Policy Group Table

PolicyGroupId PolicyId GroupTypeId
REN1 1 1 -> renewal
REN1 2 1
REN1 3 1
REN1 4 1
ADJ1 5
ADJ1 6

New policy 1
start: 1 July 2026
end: 1 July 2027
Effective date: 1 July 2026

New policy 2 [Cancellation]
start: 1 July 2026
end: 1 July 2027
Effective date: 1 August 2026

New policy 3 [Admen]
start: 1 July 2026
end: 1 July 2027
Effective date: 15 July 2026
