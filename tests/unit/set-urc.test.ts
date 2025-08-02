import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { setURC } from '../../src/set-urc';

describe('setURC', () => {
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
        codeAccountData: {
          fetch: jest.fn()
        },
        tokenReferralData: {
          fetch: jest.fn()
        }
      },
      methods: {
        setReferrerCode: jest.fn()
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
      cleanTokenName: jest.fn(),
      getMetadataByMint: jest.fn(),
      initProvider: jest.fn(),
      loadKeypairFromBase58: jest.fn(),
      loadKeypairFromFile: jest.fn()
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
    mockedUtils.cleanTokenName = mockUtils.cleanTokenName;
    mockedUtils.getMetadataByMint = mockUtils.getMetadataByMint;
    mockedUtils.initProvider = mockUtils.initProvider;
    mockedUtils.loadKeypairFromBase58 = mockUtils.loadKeypairFromBase58;
    mockedUtils.loadKeypairFromFile = mockUtils.loadKeypairFromFile;
    mockedConfig.CONFIGS = mockConfig.CONFIGS;
    mockedConfig.getNetworkType = mockConfig.getNetworkType;
  });

  describe('successful URC setting', () => {
    it('should set URC with valid parameters using keypairBs58', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Referrer123456789' }
      };

      const mockMetadata = {
        success: true,
        data: {
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      mockUtils.loadKeypairFromBase58.mockReturnValue(mockKeypair);
      mockUtils.initProvider.mockResolvedValue({
        program: mockProgram,
        provider: mockProvider,
        programId: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV'
      });
      mockUtils.getMetadataByMint.mockResolvedValue(mockMetadata);
      mockUtils.cleanTokenName.mockImplementation((name) => name.replace(/\x00/g, '').trim());
      mockConnection.getAccountInfo.mockResolvedValue(null); // No existing code account
      mockProgram.methods.setReferrerCode.mockReturnValue({
        accounts: jest.fn().mockReturnThis(),
        instruction: jest.fn().mockResolvedValue({})
      });
      mockProvider.sendAndConfirm.mockResolvedValue('mock-transaction-signature');
      mockConfig.getNetworkType.mockReturnValue('devnet');

      // Act
      await setURC(mockOptions);

      // Assert
      expect(mockUtils.loadKeypairFromBase58).toHaveBeenCalledWith(mockOptions.keypairBs58);
      expect(mockUtils.getMetadataByMint).toHaveBeenCalled();
      expect(mockProvider.sendAndConfirm).toHaveBeenCalled();
    });

    it('should set URC with valid parameters using keypairFile', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairFile: '/path/to/keypair.json',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Referrer123456789' }
      };

      const mockMetadata = {
        success: true,
        data: {
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      mockUtils.loadKeypairFromFile.mockReturnValue(mockKeypair);
      mockUtils.initProvider.mockResolvedValue({
        program: mockProgram,
        provider: mockProvider,
        programId: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV'
      });
      mockUtils.getMetadataByMint.mockResolvedValue(mockMetadata);
      mockUtils.cleanTokenName.mockImplementation((name) => name.replace(/\x00/g, '').trim());
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockProgram.methods.setReferrerCode.mockReturnValue({
        accounts: jest.fn().mockReturnThis(),
        instruction: jest.fn().mockResolvedValue({})
      });
      mockProvider.sendAndConfirm.mockResolvedValue('mock-transaction-signature');
      mockConfig.getNetworkType.mockReturnValue('devnet');

      // Act
      await setURC(mockOptions);

      // Assert
      expect(mockUtils.loadKeypairFromFile).toHaveBeenCalledWith(mockOptions.keypairFile);
      expect(mockProvider.sendAndConfirm).toHaveBeenCalled();
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
      await expect(setURC(mockOptions)).rejects.toThrow();
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
      await expect(setURC(mockOptions)).rejects.toThrow();
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
      await expect(setURC(mockOptions)).rejects.toThrow();
    });

    it('should handle existing code account gracefully', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Referrer123456789' }
      };

      const mockMetadata = {
        success: true,
        data: {
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      mockUtils.loadKeypairFromBase58.mockReturnValue(mockKeypair);
      mockUtils.initProvider.mockResolvedValue({
        program: mockProgram,
        provider: mockProvider,
        programId: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV'
      });
      mockUtils.getMetadataByMint.mockResolvedValue(mockMetadata);
      mockConnection.getAccountInfo.mockResolvedValue({ data: Buffer.alloc(0) }); // Existing code account
      mockProgram.account.codeAccountData.fetch.mockResolvedValue({
        referralAccount: { toBase58: () => 'Referrer123456789' } // Same referrer
      });
      mockProgram.methods.setReferrerCode.mockReturnValue({
        accounts: jest.fn().mockReturnThis(),
        instruction: jest.fn().mockResolvedValue({})
      });
      mockProvider.sendAndConfirm.mockResolvedValue('mock-transaction-signature');
      mockConfig.getNetworkType.mockReturnValue('devnet');

      // Act
      await setURC(mockOptions);

      // Assert that it proceeds despite existing account
      expect(mockProvider.sendAndConfirm).toHaveBeenCalled();
    });

    it('should handle metadata retrieval failure', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        keypairBs58: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]',
        mint: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
        urc: 'TESTCODE2024'
      };

      const mockKeypair = {
        publicKey: { toBase58: () => 'Referrer123456789' }
      };

      mockUtils.loadKeypairFromBase58.mockReturnValue(mockKeypair);
      mockUtils.initProvider.mockResolvedValue({
        program: mockProgram,
        provider: mockProvider,
        programId: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV'
      });
      mockUtils.getMetadataByMint.mockResolvedValue({
        success: false,
        message: 'Metadata not found'
      });
      mockConfig.getNetworkType.mockReturnValue('devnet');

      // Act & Assert
      await expect(setURC(mockOptions)).rejects.toThrow();
    });
  });
});