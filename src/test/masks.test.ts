import { describe, expect, it } from 'vitest'
import {
  dateBRToISO, isValidCNPJ, isValidCPF, isoToDateBR, maskCEP, maskCNPJ, maskCPF, maskCpfCnpj,
  maskDateBR, maskPhoneBR, maskUF, onlyDigits, unmask,
} from '../lib/masks'

describe('máscaras de cadastro', () => {
  it('formata CPF progressivamente', () => {
    expect(maskCPF('')).toBe('')
    expect(maskCPF('123')).toBe('123')
    expect(maskCPF('1234')).toBe('123.4')
    expect(maskCPF('1234567')).toBe('123.456.7')
    expect(maskCPF('12345678901')).toBe('123.456.789-01')
    expect(maskCPF('123.456.789-01')).toBe('123.456.789-01')
    expect(maskCPF('12345678901999')).toBe('123.456.789-01')
  })

  it('formata CNPJ progressivamente', () => {
    expect(maskCNPJ('11222333')).toBe('11.222.333')
    expect(maskCNPJ('11222333000181')).toBe('11.222.333/0001-81')
    expect(maskCNPJ('11.222.333/0001-81')).toBe('11.222.333/0001-81')
  })

  it('alterna CPF/CNPJ pelo tamanho', () => {
    expect(maskCpfCnpj('12345678901')).toBe('123.456.789-01')
    expect(maskCpfCnpj('112223330001')).toBe('11.222.333/0001')
  })

  it('formata CEP', () => {
    expect(maskCEP('01310')).toBe('01310')
    expect(maskCEP('01310930')).toBe('01310-930')
    expect(maskCEP('01310-930')).toBe('01310-930')
  })

  it('formata telefone fixo e celular', () => {
    expect(maskPhoneBR('')).toBe('')
    expect(maskPhoneBR('11')).toBe('(11')
    expect(maskPhoneBR('1198765')).toBe('(11) 98765')
    expect(maskPhoneBR('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhoneBR('1133334444')).toBe('(11) 3333-4444')
    expect(maskPhoneBR('+55 (11) 98765-4321')).toBe('(11) 98765-4321')
  })

  it('normaliza UF', () => {
    expect(maskUF('sp')).toBe('SP')
    expect(maskUF('s1p2z')).toBe('SP')
  })

  it('formata e converte datas', () => {
    expect(maskDateBR('15031990')).toBe('15/03/1990')
    expect(maskDateBR('1503')).toBe('15/03')
    expect(isoToDateBR('1990-03-15')).toBe('15/03/1990')
    expect(dateBRToISO('15/03/1990')).toBe('1990-03-15')
    expect(dateBRToISO('31/02/1990')).toBe('')
    expect(dateBRToISO('15/03')).toBe('')
  })

  it('extrai dígitos', () => {
    expect(onlyDigits('(11) 98765-4321')).toBe('11987654321')
    expect(unmask('123.456.789-01')).toBe('12345678901')
  })

  it('valida CPF por dígito verificador', () => {
    expect(isValidCPF('390.533.447-05')).toBe(true)
    expect(isValidCPF('111.444.777-35')).toBe(true)
    expect(isValidCPF('123.456.789-00')).toBe(false)
    expect(isValidCPF('111.111.111-11')).toBe(false)
  })

  it('valida CNPJ por dígito verificador', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false)
    expect(isValidCNPJ('00.000.000/0000-00')).toBe(false)
  })
})
