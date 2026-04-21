/**
 * Shared ApexCharts sparkline options for Companies stats cards (template + TillFlow).
 * Keeps the super-admin /companies page DRY with platform Companies.
 */

const defaultCategories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function baseSparklineOptions(seriesData) {
  return {
    series: [{ name: 'Series', data: seriesData }],
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0,
        opacityTo: 0
      }
    },
    chart: {
      foreColor: '#fff',
      type: 'area',
      width: 50,
      toolbar: { show: false },
      zoom: { enabled: false },
      dropShadow: {
        top: 3,
        left: 14,
        blur: 4,
        opacity: 0.12,
        color: '#fff'
      },
      sparkline: { enabled: true }
    },
    markers: {
      size: 0,
      colors: ['#F26522'],
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: { size: 7 }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '35%',
        borderRadius: 4
      }
    },
    dataLabels: { enabled: false },
    stroke: {
      show: true,
      width: 2.5,
      curve: 'smooth'
    },
    colors: ['#F26522'],
    xaxis: { categories: defaultCategories },
    tooltip: {
      theme: 'dark',
      fixed: { enabled: false },
      x: { show: false },
      y: {
        title: {
          formatter() {
            return '';
          }
        }
      },
      marker: { show: false }
    }
  };
}

export const companiesStatsChartPresets = {
  total: baseSparklineOptions([25, 66, 41, 12, 36, 9, 21]),
  active: baseSparklineOptions([15, 8, 20, 12, 23, 16, 10]),
  inactive: baseSparklineOptions([20, 3, 10, 25, 3, 8, 21]),
  location: baseSparklineOptions([30, 40, 15, 23, 20, 23, 25])
};
