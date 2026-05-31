/**
 * Nomes e telefones plausíveis para seeds e correção de dados de teste.
 */

const REAL_CLIENT_NAMES = [
  'Lucas Ferreira',
  'Gabriel Souza',
  'Rafael Oliveira',
  'Matheus Almeida',
  'Bruno Costa',
  'Felipe Santos',
  'Gustavo Lima',
  'Diego Martins',
  'Thiago Ribeiro',
  'Leonardo Carvalho',
  'Vinícius Pereira',
  'Rodrigo Nascimento',
  'André Barbosa',
  'Henrique Castro',
  'Daniel Rocha',
  'Marcelo Dias',
  'Fábio Teixeira',
  'Caio Mendes',
  'Igor Azevedo',
  'Renato Campos',
  'Paulo Henrique Silva',
  'João Pedro Freitas',
  'Murilo Cunha',
  'Eduardo Pinto',
  'Victor Cardoso',
  'Samuel Gomes',
  'Nicolas Duarte',
  'Otávio Monteiro',
  'Cauã Lopes',
  'Enzo Correia',
  'Pedro Augusto',
  'Guilherme Vieira',
  'Leandro Moura',
  'Alexandre Farias',
  'William Borges',
  'Jonathan Peixoto',
  'Cristiano Ramos',
  'Adriano Melo',
  'Wesley Nunes',
  'Douglas Barros',
  'Júlio César',
  'Márcio Antunes',
  'Sérgio Batista',
  'Rogério Pires',
  'Cláudio Miranda',
  'Fernando Rezende',
  'Antônio Prado',
  'Carlos Eduardo',
  'Roberto Assis',
  'Marcos Vinícius',
  'Ricardo Tavares',
  'Alex Sandro',
  'Patrick Moura',
  'Yuri Santana',
  'Kauã Rodrigues',
  'Benjamin Sales',
  'Heitor Coelho',
  'Luan Bezerra',
  'Ryan Cavalcanti',
  'Arthur Fonseca',
  'Bernardo Machado',
  'Davi Xavier',
  'Miguel Andrade',
  'Nathan Rios',
  'Ian Moreira',
  'Breno Aguiar',
  'Caleb Siqueira',
  'Emanuel Toledo',
  'Giovanni Marques',
  'Hugo Braga',
  'Isaac Viana',
  'Joaquim Paiva',
  'Kaique Neves',
  'Lorenzo Guimarães',
  'Maurício Leite',
  'Noah Freire',
  'Orlando Matos',
  'Pietro Amorim',
  'Quirino Bastos',
  'Raul Pinheiro',
  'Saulo Furtado',
  'Túlio Barreto',
  'Ulisses Dantas',
  'Vitor Hugo',
  'Wagner Soares',
  'Xavier Muniz',
  'Yago Pacheco',
  'Zeca Galvão',
];

/** Nome genérico de seed / placeholder */
function isSyntheticClientName(name) {
  const n = String(name || '').trim();
  if (!n || n.toLowerCase() === 'cliente') return true;
  if (/^cliente\s*teste\b/i.test(n)) return true;
  if (/^cliente\s+\d{1,2}\/\d{1,2}\s*#/i.test(n)) return true;
  if (/^cliente\s+#\d+/i.test(n)) return true;
  if (/^cliente\s+\d{2}\/\d{2}/i.test(n)) return true;
  return false;
}

/** Telefone BR fictício estável por índice (evita colisão entre seeds) */
function phoneForSeedIndex(index, ddd = '11') {
  const n = 900000000 + ((index * 48271) % 1000000000);
  const digits = String(n).slice(-9);
  return `${ddd}${digits}`;
}

function clientAt(index, ddd = '11') {
  const name = REAL_CLIENT_NAMES[index % REAL_CLIENT_NAMES.length];
  return {
    name,
    phone: phoneForSeedIndex(index, ddd),
  };
}

module.exports = {
  REAL_CLIENT_NAMES,
  isSyntheticClientName,
  phoneForSeedIndex,
  clientAt,
};
