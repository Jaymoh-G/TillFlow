import {
  user02,
  user03,
  user05,
  user06,
  user12,
  user16,
  user19,
  user26
} from "../../utils/imagepath";

/** Demo rows — dates kept near “today” so due-date filters stay meaningful in dev. */
export const invoicereportdata = [
  {
    id: 1,
    invoiceno: "INV001",
    image: user19,
    customer: "Thomas",
    issueDate: "18 Feb 2026",
    duedate: "28 Mar 2026",
    amount: "$1000",
    paid: "$1000",
    amountdue: "$0.00",
    status: "Paid"
  },
  {
    id: 2,
    invoiceno: "INV002",
    customer: "Rose",
    image: user02,
    issueDate: "22 Feb 2026",
    duedate: "02 Apr 2026",
    amount: "$1500",
    paid: "$0.00",
    amountdue: "$1500",
    status: "Unpaid"
  },
  {
    id: 3,
    invoiceno: "INV003",
    customer: "Benjamin",
    image: user05,
    issueDate: "25 Feb 2026",
    duedate: "05 Apr 2026",
    amount: "$1800",
    paid: "$1800",
    amountdue: "$0.00",
    status: "Paid"
  },
  {
    id: 4,
    invoiceno: "INV004",
    customer: "Kaitlin",
    image: user16,
    issueDate: "01 Mar 2026",
    duedate: "28 Mar 2026",
    amount: "$2000",
    paid: "$1000",
    amountdue: "$1000",
    status: "Overdue"
  },
  {
    id: 5,
    invoiceno: "INV005",
    customer: "Lilly",
    image: user03,
    issueDate: "05 Mar 2026",
    duedate: "10 Apr 2026",
    amount: "$800",
    paid: "$800",
    amountdue: "$0.00",
    status: "Paid"
  },
  {
    id: 6,
    invoiceno: "INV006",
    customer: "Freda",
    image: user12,
    issueDate: "08 Mar 2026",
    duedate: "15 Apr 2026",
    amount: "$750",
    paid: "$0.00",
    amountdue: "$750",
    status: "Unpaid"
  },
  {
    id: 7,
    invoiceno: "INV007",
    customer: "Alwin",
    image: user06,
    issueDate: "12 Mar 2026",
    duedate: "20 Apr 2026",
    amount: "$1300",
    paid: "$1300",
    amountdue: "$0.00",
    status: "Paid"
  },
  {
    id: 8,
    invoiceno: "INV008",
    customer: "Maybelle",
    image: user12,
    issueDate: "15 Mar 2026",
    duedate: "25 Apr 2026",
    amount: "$1100",
    paid: "$1100",
    amountdue: "$0.00",
    status: "Paid"
  },
  {
    id: 9,
    invoiceno: "INV009",
    customer: "Ellen",
    image: user16,
    issueDate: "20 Mar 2026",
    duedate: "30 Apr 2026",
    amount: "$2300",
    paid: "$2300",
    amountdue: "$0.00",
    status: "Paid"
  },
  {
    id: 10,
    invoiceno: "INV010",
    customer: "Grace",
    image: user26,
    issueDate: "25 Mar 2026",
    duedate: "18 May 2026",
    amount: "$1700",
    paid: "$1700",
    amountdue: "$0.00",
    status: "Paid"
  }
];
