import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, FlatList
} from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SalaryScreen = () => {
  const { user } = useAuth();
  const [currentSalary, setCurrentSalary] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadSalaryData();
  }, [selectedMonth, selectedYear]);

  const loadSalaryData = async () => {
    try {
      // Get current month salary
      const current = await api.getMonthlySalary(user._id, selectedMonth, selectedYear);
      setCurrentSalary(current);

      // Get history
      const history = await api.getSalaryHistory(user._id);
      setSalaryHistory(history);
    } catch (error) {
      console.error('Failed to load salary data:', error);
    }
  };

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const renderSalaryCard = () => {
    if (!currentSalary) return null;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Salary for {getMonthName(selectedMonth)} {selectedYear}
        </Text>

        <View style={styles.salaryRow}>
          <Text style={styles.label}>Base Salary:</Text>
          <Text style={styles.value}>${currentSalary.baseSalary}</Text>
        </View>

        <View style={styles.salaryRow}>
          <Text style={styles.label}>Present Days:</Text>
          <Text style={styles.value}>{currentSalary.proratedDays?.toFixed(1)}</Text>
        </View>

        <View style={styles.salaryRow}>
          <Text style={styles.label}>Overtime:</Text>
          <Text style={styles.value}>${currentSalary.overtimeEarnings}</Text>
        </View>

        <View style={styles.salaryRow}>
          <Text style={styles.label}>Bonuses:</Text>
          <Text style={[styles.value, { color: 'green' }]}>
            +${(currentSalary.totalEarnings - currentSalary.baseSalary - currentSalary.overtimeEarnings).toFixed(2)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.salaryRow}>
          <Text style={styles.label}>Fines:</Text>
          <Text style={[styles.value, { color: 'red' }]}>
            -${currentSalary.totalDeductions}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.salaryRow}>
          <Text style={[styles.label, { fontWeight: 'bold' }]}>NET SALARY:</Text>
          <Text style={[styles.value, { fontWeight: 'bold', fontSize: 20 }]}>
            ${currentSalary.netSalary}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text>Status: </Text>
          <Text style={[
            styles.statusText,
            currentSalary.paymentStatus === 'paid' ? styles.paid :
            currentSalary.paymentStatus === 'processed' ? styles.processed :
            styles.pending
          ]}>
            {currentSalary.paymentStatus?.toUpperCase()}
          </Text>
        </View>

        {currentSalary.payslipUrl && (
          <TouchableOpacity style={styles.payslipButton}>
            <Text style={styles.payslipButtonText}>Download Payslip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFineItem = ({ item }) => (
    <View style={styles.fineItem}>
      <View style={styles.fineHeader}>
        <Text style={styles.fineType}>{item.type?.category}</Text>
        <Text style={styles.fineAmount}>-${item.amount}</Text>
      </View>
      <Text style={styles.fineDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      {item.evidence?.description && (
        <Text style={styles.fineReason}>{item.evidence.description}</Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Month/Year Selector */}
      <View style={styles.selector}>
        <TouchableOpacity onPress={prevMonth}>
          <Text style={styles.arrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthYear}>
          {getMonthName(selectedMonth)} {selectedYear}
        </Text>
        <TouchableOpacity onPress={nextMonth}>
          <Text style={styles.arrow}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Salary Card */}
      {renderSalaryCard()}

      {/* Fines Breakdown */}
      {currentSalary?.fines?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fines Breakdown</Text>
          <FlatList
            data={currentSalary.fines}
            renderItem={renderFineItem}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Loan Deductions */}
      {currentSalary?.loanDeductions?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loan Deductions</Text>
          {currentSalary.loanDeductions.map((loan, index) => (
            <View key={index} style={styles.loanItem}>
              <Text>Loan Installment</Text>
              <Text style={styles.loanAmount}>-${loan.amount}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Salary History */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Salary History</Text>
        {salaryHistory.map((salary, index) => (
          <TouchableOpacity
            key={index}
            style={styles.historyItem}
            onPress={() => {
              setSelectedMonth(salary.month);
              setSelectedYear(salary.year);
            }}
          >
            <Text>{getMonthName(salary.month)} {salary.year}</Text>
            <Text style={styles.historyAmount}>${salary.netSalary}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const getMonthName = (month) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 10
  },
  arrow: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 10
  },
  monthYear: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  card: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 10,
    elevation: 2
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  label: {
    color: '#666'
  },
  value: {
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 10
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  statusText: {
    fontWeight: 'bold'
  },
  paid: {
    color: 'green'
  },
  processed: {
    color: 'blue'
  },
  pending: {
    color: 'orange'
  },
  payslipButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15
  },
  payslipButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  fineItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10
  },
  fineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  fineType: {
    textTransform: 'capitalize'
  },
  fineAmount: {
    color: 'red',
    fontWeight: 'bold'
  },
  fineDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2
  },
  fineReason: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  loanItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  loanAmount: {
    color: 'red',
    fontWeight: 'bold'
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  historyAmount: {
    fontWeight: 'bold'
  }
});

export default SalaryScreen;
