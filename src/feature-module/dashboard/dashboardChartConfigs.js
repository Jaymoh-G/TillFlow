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
