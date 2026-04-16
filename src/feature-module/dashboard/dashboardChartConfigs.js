/** ApexCharts + Chart.js options extracted from the admin dashboard (formerly inline in newDashboard). */

export const salesDayChart = {
  chart: {
    height: 245,
    type: "bar",
    stacked: true,
    toolbar: {
      show: false
    }
  },
  colors: ["#FE9F43", "#FFE3CB"],
  responsive: [
    {
      breakpoint: 480,
      options: {
        legend: {
          position: "bottom",
          offsetX: -10,
          offsetY: 0
        }
      }
    }
  ],
  plotOptions: {
    bar: {
      borderRadius: 8,
      borderRadiusWhenStacked: "all",
      horizontal: false,
      endingShape: "rounded"
    }
  },
  series: [
    {
      name: "Sales",
      data: [18, 20, 10, 18, 25, 18, 10, 20, 40, 8, 30, 20]
    },
    {
      name: "Purchase",
      data: [40, 30, 30, 50, 40, 50, 30, 30, 50, 30, 40, 30]
    }
  ],
  xaxis: {
    categories: [
      "2 am",
      "4 am",
      "6 am",
      "8 am",
      "10 am",
      "12 am",
      "14 pm",
      "16 pm",
      "18 pm",
      "20 pm",
      "22 pm",
      "24 pm"
    ],
    labels: {
      style: {
        colors: "#6B7280",
        fontSize: "13px"
      }
    }
  },
  yaxis: {
    labels: {
      formatter: (val) => `${val}K`,
      offsetX: -15,
      style: {
        colors: "#6B7280",
        fontSize: "13px"
      }
    }
  },
  grid: {
    borderColor: "#E5E7EB",
    strokeDashArray: 5,
    padding: {
      left: -16,
      top: 0,
      bottom: 0,
      right: 0
    }
  },
  legend: {
    show: false
  },
  dataLabels: {
    enabled: false
  },
  fill: {
    opacity: 1
  }
};

export const customerChart = {
  chart: {
    type: "radialBar",
    height: 130,
    width: "100%",
    parentHeightOffset: 0,
    toolbar: {
      show: false
    }
  },
  plotOptions: {
    radialBar: {
      hollow: {
        margin: 10,
        size: "30%"
      },
      track: {
        background: "#E6EAED",
        strokeWidth: "100%",
        margin: 5
      },
      dataLabels: {
        name: {
          offsetY: -5
        },
        value: {
          offsetY: 5
        }
      }
    }
  },
  grid: {
    padding: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    }
  },
  stroke: {
    lineCap: "round"
  },
  colors: ["#E04F16", "#0E9384"],
  labels: ["First Time", "Return"]
};

/** Radial chart series values (First Time / Return). */
export const customerRadialSeries = [70, 70];

/** Sales Statics stacked bar (Revenue vs Expenses). */
export const revenueExpenseBarOptions = {
  series: [
    {
      name: "Revenue",
      data: [9, 25, 25, 20, 20, 18, 25, 15, 20, 12, 8, 20]
    },
    {
      name: "Expenses",
      data: [-10, -18, -9, -20, -20, -10, -20, -20, -8, -15, -18, -20]
    }
  ],
  grid: {
    padding: {
      top: 5,
      right: 5
    }
  },
  colors: ["#0E9384", "#E04F16"],
  chart: {
    type: "bar",
    height: 290,
    stacked: true,
    zoom: {
      enabled: true
    }
  },
  responsive: [
    {
      breakpoint: 280,
      options: {
        legend: {
          position: "bottom",
          offsetY: 0
        }
      }
    }
  ],
  plotOptions: {
    bar: {
      horizontal: false,
      borderRadius: 4,
      borderRadiusApplication: "around",
      borderRadiusWhenStacked: "all",
      columnWidth: "20%"
    }
  },
  dataLabels: {
    enabled: false
  },
  yaxis: {
    labels: {
      offsetX: -15,
      formatter: (val) => {
        return val / 1 + "K";
      }
    },
    min: -30,
    max: 30,
    tickAmount: 6
  },
  xaxis: {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  },
  legend: {
    show: false
  },
  fill: {
    opacity: 1
  }
};

export const categoryDoughnutData = {
  datasets: [
    {
      label: ["Lifestyles", "Sports", "Electronics"],
      data: [16, 24, 50],
      backgroundColor: ["#092C4C", "#E04F16", "#FE9F43"],
      borderWidth: 5,
      borderRadius: 10,
      hoverBorderWidth: 0,
      cutout: "50%"
    }
  ]
};

export const categoryDoughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: -20,
      bottom: -20
    }
  },
  plugins: {
    legend: {
      display: false
    }
  }
};

export const heatChart = {
  chart: {
    type: "heatmap",
    height: 370
  },
  plotOptions: {
    heatmap: {
      radius: 4,
      enableShades: false,
      colorScale: {
        ranges: [
          {
            from: 0,
            to: 99,
            color: "#FFE3CB"
          },
          {
            from: 100,
            to: 200,
            color: "#FE9F43"
          }
        ]
      }
    }
  },
  legend: {
    show: false
  },
  dataLabels: {
    enabled: false
  },
  grid: {
    padding: {
      top: -20,
      bottom: 0,
      left: 0,
      right: 0
    }
  },
  yaxis: {
    labels: {
      offsetX: -15
    }
  },
  series: [
    {
      name: "2 Am",
      data: [
        { x: "Mon", y: 100 },
        { x: "Tue", y: 100 },
        { x: "Wed", y: 100 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 32 },
        { x: "Sat", y: 32 },
        { x: "Sun", y: 32 }
      ]
    },
    {
      name: "4 Am",
      data: [
        { x: "Mon", y: 100, color: "#ff5722" },
        { x: "Tue", y: 100 },
        { x: "Wed", y: 100 },
        { x: "Thu", y: 120 },
        { x: "Fri", y: 32 },
        { x: "Sat", y: 50 },
        { x: "Sun", y: 40 }
      ]
    },
    {
      name: "6 Am",
      data: [
        { x: "Mon", y: 22 },
        { x: "Tue", y: 29 },
        { x: "Wed", y: 13 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 32 },
        { x: "Sat", y: 32 },
        { x: "Sun", y: 32 }
      ]
    },
    {
      name: "8 Am",
      data: [
        { x: "Mon", y: 0 },
        { x: "Tue", y: 29 },
        { x: "Wed", y: 13 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 30 },
        { x: "Sat", y: 100 },
        { x: "Sun", y: 100 }
      ]
    },
    {
      name: "10 Am",
      data: [
        { x: "Mon", y: 200 },
        { x: "Tue", y: 200 },
        { x: "Wed", y: 200 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 0 },
        { x: "Sat", y: 0 },
        { x: "Sun", y: 32 }
      ]
    },
    {
      name: "12 Am",
      data: [
        { x: "Mon", y: 0 },
        { x: "Tue", y: 0 },
        { x: "Wed", y: 75 },
        { x: "Thu", y: 0 },
        { x: "Fri", y: 0 },
        { x: "Sat", y: 0 },
        { x: "Sun", y: 0 }
      ]
    },
    {
      name: "14 Pm",
      data: [
        { x: "Mon", y: 0 },
        { x: "Tue", y: 20 },
        { x: "Wed", y: 13 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 0 },
        { x: "Sat", y: 0 },
        { x: "Sun", y: 32 }
      ]
    },
    {
      name: "16 Pm",
      data: [
        { x: "Mon", y: 13 },
        { x: "Tue", y: 20 },
        { x: "Wed", y: 13 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 200 },
        { x: "Sat", y: 13 },
        { x: "Sun", y: 32 }
      ]
    },
    {
      name: "18 Am",
      data: [
        { x: "Mon", y: 0 },
        { x: "Tue", y: 20 },
        { x: "Wed", y: 13 },
        { x: "Thu", y: 32 },
        { x: "Fri", y: 0 },
        { x: "Sat", y: 200 },
        { x: "Sun", y: 200 }
      ]
    }
  ]
};
