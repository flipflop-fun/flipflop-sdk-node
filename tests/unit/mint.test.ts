import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mint } from '../../src/mint';
import { Connection, PublicKey } from '@solana/web3.js';

// Mock dependencies
jest.mock('@solana/web3.js');
jest.mock('../../src/utils');
jest.mock('../../src/config');

// Import mocked modules
const mockedUtils = require('../../src/utils');
const mockedConfig = require('../../src/config');

describe('mint', () => {
  let mockConnection: any;
  let mockProgram: any;
  let mockProvider: any;
  let mockUtils: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock connection
    mockConnection = {
      getAccountInfo: jest.fn(),
      getParsedAccountInfo: jest.fn()
    };

    // Setup mock program
    mockProgram = {
      account: {
        systemConfigData: {
          fetch: jest.fn()
        },
        tokenReferralData: {
          fetch: jest.fn()
        },
        codeAccountData: {
          fetch: jest.fn()
        }
      },
      methods: {
        mintTokens: jest.fn()
      }
    };

    // Setup mock provider
    mockProvider = {
      connection: mockConnection,
      sendAndConfirm: jest.fn(),
      publicKey: { toBase58: () => 'mock-public-key' }
    };

    // Setup mocked utils
    mockUtils = {
      getURCDetails: jest.fn(),
      loadKeypairFromBase58: jest.fn(),
      loadKeypairFromFile: jest.fn(),
      getMetadataByMint: jest.fn(),
      cleanTokenName: jest.fn(),
      mintBy: jest.fn()
    };

    // Setup mocked config
    mockConfig = {
      CONFIGS: {
        devnet: {
          systemManagerAccount: 'SystemManager123',
          lookupTableAccount: 'LookupTable123'
        }
      },
      getNetworkType: jest.fn()
    };

    // Mock the modules
    mockedUtils.getURCDetails = mockUtils.getURCDetails;
    mockedUtils.loadKeypairFromBase58 = mockUtils.loadKeypairFromBase58;
    mockedUtils.loadKeypairFromFile = mockUtils.loadKeypairFromFile;
    mockedUtils.getMetadataByMint = mockUtils.getMetadataByMint;
    mockedUtils.cleanTokenName = mockUtils.cleanTokenName;
    mockedUtils.mintBy = mockUtils.mintBy;
    mockedConfig.CONFIGS = mockConfig.CONFIGS;
    mockedConfig.getNetworkType = mockConfig.getNetworkType;
  });

  describe('successful minting', () => {
    it('should mint tokens with valid parameters', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Minter123456789' }
      };

      const mockURCDetails = {
        referrerMain: { toBase58: () => 'Referrer123456789' },
        referrerAta: { toBase58: () => 'ReferrerATA123456789' }
      };

      const mockMetadata = {
        success: true,
        data: {
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      const mockMintResult = {
        success: true,
        tx: 'mock-transaction-signature',
        tokenAccount: 'mock-token-account'
      };

      mockUtils.loadKeypairFromBase58.mockReturnValue(mockKeypair);
      mockUtils.getURCDetails.mockResolvedValue(mockURCDetails);
      mockUtils.getMetadataByMint.mockResolvedValue(mockMetadata);
      mockUtils.cleanTokenName.mockImplementation((name) => name.replace(/\x00/g, '').trim());
      mockUtils.mintBy.mockResolvedValue(mockMintResult);
      mockConfig.getNetworkType.mockReturnValue('devnet');

      // Act
      const result = await mint(mockOptions);

      // Assert
      expect(mockUtils.loadKeypairFromBase58).toHaveBeenCalledWith(mockOptions.keypairBs58);
      expect(mockUtils.getURCDetails).toHaveBeenCalled();
      expect(mockUtils.mintBy).toHaveBeenCalled();
    });

    it('should mint tokens with keypair file', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairFile: '/path/to/keypair.json',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Minter123456789' }
      };

      const mockURCDetails = {
        referrerMain: { toBase58: () => 'Referrer123456789' },
        referrerAta: { toBase58: () => 'ReferrerATA123456789' }
      };

      const mockMetadata = {
        success: true,
        data: {
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      const mockMintResult = {
        success: true,
        tx: 'mock-transaction-signature',
        tokenAccount: 'mock-token-account'
      };

      mockUtils.loadKeypairFromFile.mockReturnValue(mockKeypair);
      mockUtils.getURCDetails.mockResolvedValue(mockURCDetails);
      mockUtils.getMetadataByMint.mockResolvedValue(mockMetadata);
      mockUtils.cleanTokenName.mockImplementation((name) => name.replace(/\x00/g, '').trim());
      mockUtils.mintBy.mockResolvedValue(mockMintResult);
      mockConfig.getNetworkType.mockReturnValue('devnet');

      // Act
      const result = await mint(mockOptions);

      // Assert
      expect(mockUtils.loadKeypairFromFile).toHaveBeenCalledWith(mockOptions.keypairFile);
      expect(mockUtils.getURCDetails).toHaveBeenCalled();
      expect(mockUtils.mintBy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error for missing keypair', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      // Act & Assert
      await expect(mint(mockOptions)).rejects.toThrow();
    });

    it('should throw error for invalid mint address', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3]',
        mint: 'invalid-address',
        urc: 'TESTCODE2024'
      };

      // Act & Assert
      await expect(mint(mockOptions)).rejects.toThrow();
    });

    it('should throw error for invalid URC', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: ''
      };

      // Act & Assert
      await expect(mint(mockOptions)).rejects.toThrow();
    });

    it('should handle mint operation failure', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Minter123456789' }
      };

      const mockURCDetails = {
        referrerMain: { toBase58: () => 'Referrer123456789' },
        referrerAta: { toBase58: () => 'ReferrerATA123456789' }
      };

      mockUtils.loadKeypairFromBase58.mockReturnValue(mockKeypair);
      mockUtils.getURCDetails.mockResolvedValue(mockURCDetails);
      mockUtils.getMetadataByMint.mockResolvedValue({
        success: true,
        data: { name: 'Test Token', symbol: 'TEST' }
      });
      mockUtils.mintBy.mockResolvedValue({ success: false });

      // Act
      const result = await mint(mockOptions);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('input validation', () => {
    it('should validate URC format', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'VALID-URC-2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Minter123456789' }
      };

      const mockURCDetails = {
        referrerMain: { toBase58: () => 'Referrer123456789' },
        referrerAta: { toBase58: () => 'ReferrerATA123456789' }
      };

      mockUtils.loadKeypairFromBase58.mockReturnValue(mockKeypair);
      mockUtils.getURCDetails.mockResolvedValue(mockURCDetails);
      mockUtils.getMetadataByMint.mockResolvedValue({
        success: true,
        data: { name: 'Test Token', symbol: 'TEST' }
      });
      mockUtils.mintBy.mockResolvedValue({ success: true });

      // Act
      await mint(mockOptions);

      // Assert
      expect(mockUtils.getURCDetails).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'VALID-URC-2024');
    });
  });
});